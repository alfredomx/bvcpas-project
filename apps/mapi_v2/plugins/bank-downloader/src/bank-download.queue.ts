import { Injectable } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Job, Queue } from 'bullmq'
import { QueueBoardRegistry } from '@/core/queue/queue-board.registry'
import { BankDownloadService } from './bank-download.service'
import { BankSessionService } from './bank-session.service'
import type { ProgressFn } from './bank-download.types'
import type {
  DownloadChecksDto,
  DownloadDepositsDto,
  DownloadStatementsDto,
  DownloadTransactionsDto,
} from './dto/bank-download.dto'

/** Nombre de la cola de descarga bancaria. Esta cola pertenece al plugin (no al core). */
export const BANK_DOWNLOAD_QUEUE = 'bank-download'

/**
 * Job de descarga bancaria. Toda descarga pasa por la cola: choke point de "1
 * sesión de banco a la vez" (worker con `concurrency: 1`) + reintentos. Cada
 * `kind` corresponde a un verbo de descarga; el `dto` ya viene validado por Zod
 * en el controller.
 */
export type BankDownloadJob =
  | { kind: 'checks'; dto: DownloadChecksDto }
  | { kind: 'deposits'; dto: DownloadDepositsDto }
  | { kind: 'statements'; dto: DownloadStatementsDto }
  | { kind: 'transactions'; dto: DownloadTransactionsDto }

/**
 * Worker fire-and-forget: **hace TODO** lo necesario para descargar, sin asumir
 * nada. Por cada job: asegura la sesión (`listAccounts` → fast-path si ya está
 * viva, o login) → descarga → logout condicional. Si el login falla, propaga y el
 * job falla honesto (visible en bull-board). `concurrency: 1` serializa (no 2
 * logins de banco a la vez). El resultado (resumen + `saved_dir`) queda como
 * returnvalue del job; los archivos quedan en disco.
 *
 * El cierre de sesión es condicional: si otro job pendiente usa la MISMA
 * credencial, se deja la sesión viva para que la reuse por fast-path. `endSession`
 * es best-effort (nunca lanza), y corre también si el login dejó una pestaña.
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

  async process(job: Job<BankDownloadJob>): Promise<unknown> {
    const d = job.data
    const onProgress: ProgressFn = (p) => job.updateProgress(p)

    try {
      // El worker asegura la sesión antes de descargar (fast-path o login). Si
      // falla, propaga → job failed; el finally cierra cualquier pestaña abierta.
      await this.session.listAccounts(d.dto.credentialId)
      switch (d.kind) {
        case 'checks':
          return await this.service.downloadChecks(d.dto, onProgress)
        case 'deposits':
          return await this.service.downloadDeposits(d.dto, onProgress)
        case 'statements':
          return await this.service.downloadStatements(d.dto, onProgress)
        case 'transactions':
          return await this.service.downloadTransactions(d.dto, onProgress)
      }
      return undefined // union de kinds exhausta; satisface noImplicitReturns
    } finally {
      // Cierre condicional: solo si ningún job pendiente reusa la misma sesión.
      if (!(await this.sessionNeededByPending(d.dto.credentialId))) {
        await this.session.endSession(d.dto.credentialId)
      }
    }
  }

  /**
   * ¿Algún job pendiente (waiting/delayed/prioritized) usa la MISMA credencial
   * (= mismo login)? Si sí, dejamos la sesión viva para que el siguiente job la
   * reuse por fast-path (`getAllAccounts()`) sin re-loguear.
   */
  private async sessionNeededByPending(credentialId: string): Promise<boolean> {
    const pending = await this.queue.getJobs(['waiting', 'delayed', 'prioritized'])
    return pending.some((j) => (j.data as BankDownloadJob).dto.credentialId === credentialId)
  }
}

/**
 * Encola una descarga **sin esperar** (fire-and-forget): el caller recibe el
 * `jobId` al instante y se desentiende; el worker la procesa después. El avance,
 * el resultado y los fallos quedan en bull-board.
 */
@Injectable()
export class BankDownloadQueueService {
  constructor(
    @InjectQueue(BANK_DOWNLOAD_QUEUE) private readonly queue: Queue,
    board: QueueBoardRegistry,
  ) {
    // Da de alta la cola en el dashboard del core (bull-board). Cero-reach: el
    // core no conoce `bank-download`; este plugin lo registra.
    board.register(BANK_DOWNLOAD_QUEUE)
  }

  /** Encola `job` con nombre `label` y devuelve su `jobId` (sin esperar). */
  async enqueue(job: BankDownloadJob, label: string): Promise<string> {
    const j = await this.queue.add(label, job, {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    })
    return j.id ?? ''
  }
}
