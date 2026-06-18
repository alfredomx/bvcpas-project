import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { BridgeFetchExecutor } from './adapters/bridge-fetch-executor'
import { BankSessionService } from './bank-session.service'
import { BankDownloadService } from './bank-download.service'
import {
  BANK_DOWNLOAD_QUEUE,
  BankDownloadProcessor,
  BankDownloadQueueService,
} from './bank-download.queue'
import { BankDownloadController } from './bank-download.controller'

/**
 * NestModule del plugin Bank Downloader. Consume del core (vía DI, son `@Global`):
 * `BANK_CREDENTIALS_PORT`, `BRIDGE_COMMAND_PORT`, `ClientsService`. Registra su
 * propia cola `bank-download` (la conexión raíz BullMQ la provee el core).
 *
 * No es dueño de tablas: las masks vienen del DTO y `clientId` se deriva del
 * credential. El step-flow corre sobre la sesión viva del banco (kiro).
 */
@Module({
  imports: [BullModule.registerQueue({ name: BANK_DOWNLOAD_QUEUE })],
  controllers: [BankDownloadController],
  providers: [
    BridgeFetchExecutor,
    BankSessionService,
    BankDownloadService,
    BankDownloadProcessor,
    BankDownloadQueueService,
  ],
})
export class BankDownloadModule {}
