import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Job, Queue, QueueEvents } from 'bullmq'
import { AppConfigService } from '../../core/config/config.service'
import { BANK_DOWNLOAD_QUEUE, connectionFromUrl } from '../../core/queue/queue.module'
import { BankDownloadService } from './bank-download.service'
import type {
  DownloadChecksDto,
  DownloadDepositsDto,
  DownloadStatementsDto,
  DownloadTransactionsDto,
} from './dto/bank-download.dto'

/**
 * Job de descarga bancaria. Toda descarga pasa por la cola (D-mapi-jobs-004):
 * choke point de "1 sesión de banco a la vez" (worker con `concurrency: 1`) +
 * visibilidad en bull-board + reintentos. Las descargas chicas se encolan **y se
 * esperan** (respuesta inline); el batch (futuro) responderá async.
 */
export type BankDownloadJob =
  | { kind: 'checks'; clientId: string; userId: string; dto: DownloadChecksDto }
  | { kind: 'deposits'; clientId: string; userId: string; dto: DownloadDepositsDto }
  | { kind: 'statements'; clientId: string; userId: string; dto: DownloadStatementsDto }
  | { kind: 'transactions'; clientId: string; userId: string; dto: DownloadTransactionsDto }

/**
 * Worker: corre el job llamando al `BankDownloadService` (mismo proceso → usa el
 * `BridgeFetchExecutor`/kiro de la sesión viva). `concurrency: 1` serializa las
 * descargas (no 2 logins de Chase a la vez). Devuelve el resultado como
 * returnvalue del job (lo lee `waitUntilFinished`).
 */
@Processor(BANK_DOWNLOAD_QUEUE, { concurrency: 1 })
export class BankDownloadProcessor extends WorkerHost {
  constructor(private readonly service: BankDownloadService) {
    super()
  }

  async process(job: Job<BankDownloadJob>): Promise<unknown> {
    const d = job.data
    await job.updateProgress(5)
    let result: unknown
    switch (d.kind) {
      case 'checks':
        result = await this.service.downloadChecks(d.clientId, d.dto, d.userId)
        break
      case 'deposits':
        result = await this.service.downloadDeposits(d.clientId, d.dto, d.userId)
        break
      case 'statements':
        result = await this.service.downloadStatements(d.clientId, d.dto, d.userId)
        break
      case 'transactions':
        result = await this.service.downloadTransactions(d.clientId, d.dto, d.userId)
        break
    }
    await job.updateProgress(100)
    return result
  }
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

  async onModuleDestroy(): Promise<void> {
    await this.events.close()
  }
}
