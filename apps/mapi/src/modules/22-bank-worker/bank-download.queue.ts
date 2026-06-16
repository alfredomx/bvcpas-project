import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Job, Queue, QueueEvents } from 'bullmq'
import { AppConfigService } from '../../core/config/config.service'
import { BANK_DOWNLOAD_QUEUE, connectionFromUrl } from '../../core/queue/queue.module'
import { BankDownloadService } from './bank-download.service'
import { BankSessionService } from './bank-session.service'
import { buildDownloadDto, resolveMasks, type DownloadWhat } from './bank-download.params'
import type { ProgressFn } from './bank-download.types'
import type {
  DownloadChecksDto,
  DownloadDepositsDto,
  DownloadStatementsDto,
  DownloadTransactionsDto,
} from './dto/bank-download.dto'

/**
 * Job de descarga bancaria. Toda descarga pasa por la cola (D-mapi-jobs-004):
 * choke point de "1 sesión de banco a la vez" (worker con `concurrency: 1`) +
 * visibilidad en bull-board + reintentos.
 *
 * Dos formas:
 *  - **`checks|deposits|statements|transactions`** (step endpoints `/clients/:id/...`):
 *    la sesión ya está viva (el operador hizo `list_accounts`), el worker SOLO
 *    descarga. Se encolan **y se esperan** (`runAndWait`, respuesta inline).
 *  - **`client-download`** (verbo único `/v1/banking/download`, v0.28.0): el worker
 *    hace TODO (login → masks → descarga → logout) para que el batch quede
 *    registrado en la cola y se serialice solo. Se encola **async** (sin esperar).
 */
export type BankDownloadJob =
  | { kind: 'checks'; clientId: string; userId: string; dto: DownloadChecksDto }
  | { kind: 'deposits'; clientId: string; userId: string; dto: DownloadDepositsDto }
  | { kind: 'statements'; clientId: string; userId: string; dto: DownloadStatementsDto }
  | { kind: 'transactions'; clientId: string; userId: string; dto: DownloadTransactionsDto }
  | {
      kind: 'client-download'
      what: DownloadWhat
      clientId: string
      credentialId: string
      userId: string
      accounts: 'all' | string[]
      params: Record<string, unknown>
    }

/**
 * Worker: corre el job llamando al `BankDownloadService` (mismo proceso → usa el
 * `BridgeFetchExecutor`/kiro de la sesión viva). `concurrency: 1` serializa las
 * descargas (no 2 logins de Chase a la vez). Devuelve el resultado como
 * returnvalue del job (lo lee `waitUntilFinished`).
 */
@Processor(BANK_DOWNLOAD_QUEUE, { concurrency: 1 })
export class BankDownloadProcessor extends WorkerHost {
  constructor(
    private readonly service: BankDownloadService,
    private readonly session: BankSessionService,
    @InjectQueue(BANK_DOWNLOAD_QUEUE) private readonly queue: Queue,
  ) {
    super()
  }

  /**
   * ¿Algún job pendiente (waiting/delayed/prioritized) usa la MISMA sesión de
   * banco (misma credencial = mismo login)? Si sí, dejamos la sesión viva para
   * que el siguiente job la reuse por fast-path (`getAllAccounts()`) sin re-loguear.
   * Si no, se cierra. Evita el ciclo login→cierre→login entre jobs de la misma
   * cuenta (ej. `deposits` + `checks`). Trade-off (opción A): si el job pendiente
   * nunca corre, la sesión queda viva hasta que otro run la reuse/cierre.
   */
  private async sessionNeededByPending(credentialId: string): Promise<boolean> {
    const pending = await this.queue.getJobs(['waiting', 'delayed', 'prioritized'])
    return pending.some((j) => credentialIdOf(j.data as BankDownloadJob) === credentialId)
  }

  async process(job: Job<BankDownloadJob>): Promise<unknown> {
    const d = job.data
    // Conecta el progreso (objeto: etapa + cuenta + done/total) a bull-board.
    const onProgress: ProgressFn = (p) => job.updateProgress(p)

    if (d.kind === 'client-download') return this.processClientDownload(d, onProgress)

    // Step endpoints: la sesión ya está viva, solo descargar.
    try {
      switch (d.kind) {
        case 'checks':
          return await this.service.downloadChecks(d.clientId, d.dto, d.userId, onProgress)
        case 'deposits':
          return await this.service.downloadDeposits(d.clientId, d.dto, d.userId, onProgress)
        case 'statements':
          return await this.service.downloadStatements(d.clientId, d.dto, d.userId, onProgress)
        case 'transactions':
          return await this.service.downloadTransactions(d.clientId, d.dto, d.userId, onProgress)
      }
      return undefined // union de kinds exhausta; satisface noImplicitReturns
    } finally {
      // Desloguear + cerrar pestaña SOLO si ningún job pendiente usa la misma
      // sesión (misma credencial). Si otro la necesita, se deja viva para que la
      // reuse por fast-path y no re-loguee. Best-effort: endSession nunca lanza.
      if (!(await this.sessionNeededByPending(d.dto.credentialId))) {
        await this.session.endSession(d.clientId, d.dto.credentialId, d.userId)
      }
    }
  }

  /**
   * Verbo único (v0.28.0): el worker hace TODO el ciclo del cliente para que el
   * batch quede en la cola (registrado + serializado + visible en bull-board):
   * login en vivo → resolver masks → armar/validar dto → descargar → (finally)
   * logout + cerrar pestaña. Al correr en el worker (concurrency 1), N clientes
   * se procesan uno a uno = una sola sesión de banco viva a la vez.
   */
  private async processClientDownload(
    d: Extract<BankDownloadJob, { kind: 'client-download' }>,
    onProgress: ProgressFn,
  ): Promise<unknown> {
    const live = await this.session.listAccounts(d.clientId, d.credentialId, d.userId)
    const accountMasks = resolveMasks(live, d.accounts)
    const dto = buildDownloadDto(d.what, d.credentialId, accountMasks, d.params)
    try {
      switch (d.what) {
        case 'checks':
          return await this.service.downloadChecks(
            d.clientId,
            dto as unknown as DownloadChecksDto,
            d.userId,
            onProgress,
          )
        case 'deposits':
          return await this.service.downloadDeposits(
            d.clientId,
            dto as unknown as DownloadDepositsDto,
            d.userId,
            onProgress,
          )
        case 'statements':
          return await this.service.downloadStatements(
            d.clientId,
            dto as unknown as DownloadStatementsDto,
            d.userId,
            onProgress,
          )
        case 'transactions':
          return await this.service.downloadTransactions(
            d.clientId,
            dto as unknown as DownloadTransactionsDto,
            d.userId,
            onProgress,
          )
      }
      return undefined // union de `what` exhausta; satisface noImplicitReturns
    } finally {
      // Cierre condicional: solo si ningún job pendiente reusa la misma sesión.
      if (!(await this.sessionNeededByPending(d.credentialId))) {
        await this.session.endSession(d.clientId, d.credentialId, d.userId)
      }
    }
  }
}

/** Credencial (= sesión de banco) que usa un job, sin importar su `kind`. */
function credentialIdOf(d: BankDownloadJob): string {
  return d.kind === 'client-download' ? d.credentialId : d.dto.credentialId
}

/**
 * Encola una descarga y **espera** su resultado (respuesta inline para descargas
 * de un cliente). Usa una `QueueEvents` compartida para `waitUntilFinished`.
 */
@Injectable()
export class BankDownloadQueueService implements OnModuleDestroy {
  private readonly events: QueueEvents

  constructor(
    @InjectQueue(BANK_DOWNLOAD_QUEUE) private readonly queue: Queue,
    cfg: AppConfigService,
  ) {
    this.events = new QueueEvents(BANK_DOWNLOAD_QUEUE, {
      connection: connectionFromUrl(cfg.redisUrl),
    })
  }

  /** Encola `job` con nombre `label` y devuelve su resultado al completarse. */
  async runAndWait<T>(job: BankDownloadJob, label: string): Promise<T> {
    const j = await this.queue.add(label, job, {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    })
    return (await j.waitUntilFinished(this.events)) as T
  }

  /**
   * Encola `job` y devuelve su `jobId` **sin esperar** (async). Para el verbo
   * único/batch: la acción queda registrada en la cola (bull-board) y el worker
   * la corre serializada; si algo falla, queda como job `failed`, no se pierde.
   */
  async enqueue(job: BankDownloadJob, label: string): Promise<string> {
    const j = await this.queue.add(label, job, {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    })
    return j.id ?? ''
  }

  async onModuleDestroy(): Promise<void> {
    await this.events.close()
  }
}
