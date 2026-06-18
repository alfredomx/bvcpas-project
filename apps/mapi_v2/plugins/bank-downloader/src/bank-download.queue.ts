import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Job, Queue, QueueEvents } from 'bullmq'
import { AppConfigService } from '@/core/config/config.service'
import { connectionFromUrl } from '@/core/queue/queue.module'
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
 * Job de descarga bancaria. Toda descarga pasa por la cola: es el choke point de
 * "1 sesión de banco a la vez" (worker con `concurrency: 1`) + reintentos. Cada
 * `kind` corresponde a un verbo de descarga; el `dto` ya viene validado por Zod
 * en el controller.
 */
export type BankDownloadJob =
  | { kind: 'checks'; dto: DownloadChecksDto }
  | { kind: 'deposits'; dto: DownloadDepositsDto }
  | { kind: 'statements'; dto: DownloadStatementsDto }
  | { kind: 'transactions'; dto: DownloadTransactionsDto }

/**
 * Worker: corre el job llamando al `BankDownloadService` (mismo proceso → usa el
 * `BridgeFetchExecutor`/kiro de la sesión viva). `concurrency: 1` serializa las
 * descargas (no 2 logins del mismo banco a la vez). Devuelve el resultado como
 * returnvalue del job (lo lee `waitUntilFinished`).
 *
 * Tras cada job desloguea + cierra la pestaña SOLO si ningún job pendiente usa la
 * misma sesión (misma credencial): así jobs consecutivos de la misma cuenta
 * (deposits + checks) reusan la sesión por fast-path sin re-loguear. `endSession`
 * es best-effort (nunca lanza).
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
 * Encola una descarga y **espera** su resultado (respuesta inline). Usa una
 * `QueueEvents` compartida para `waitUntilFinished`.
 */
@Injectable()
export class BankDownloadQueueService implements OnModuleDestroy {
  private readonly events: QueueEvents

  constructor(
    @InjectQueue(BANK_DOWNLOAD_QUEUE) private readonly queue: Queue,
    cfg: AppConfigService,
    board: QueueBoardRegistry,
  ) {
    this.events = new QueueEvents(BANK_DOWNLOAD_QUEUE, {
      connection: connectionFromUrl(cfg.redisUrl),
    })
    // Da de alta la cola en el dashboard del core (bull-board). Cero-reach: el
    // core no conoce `bank-download`; este plugin lo registra.
    board.register(BANK_DOWNLOAD_QUEUE)
  }

  /** Encola `job` con nombre `label` y devuelve su resultado al completarse. */
  async runAndWait<T>(job: BankDownloadJob, label: string): Promise<T> {
    const j = await this.queue.add(label, job, {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    })
    return (await j.waitUntilFinished(this.events)) as T
  }

  async onModuleDestroy(): Promise<void> {
    await this.events.close()
  }
}
