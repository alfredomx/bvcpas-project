import { Module } from '@nestjs/common'
import { ClientsModule } from '../11-clients/clients.module'
import { EventLogModule } from '../95-event-log/event-log.module'
import { CallLogsController } from './call-logs.controller'
import { CallLogsRepository } from './call-logs.repository'
import { CallLogsService } from './call-logs.service'

/**
 * Módulo 14-call-logs: bitácora de llamadas a clientes.
 *
 * Registro simple, no sistema de followups. CRUD básico con soft delete.
 *
 * Imports:
 *   - ClientsModule: para ClientAccessGuard + ClientsRepository.
 *   - EventLogModule: para auditoría (call_log.{created,updated,deleted}).
 */
@Module({
  imports: [ClientsModule, EventLogModule],
  controllers: [CallLogsController],
  providers: [CallLogsRepository, CallLogsService],
})
export class CallLogsModule {}
