import { Global, Module } from '@nestjs/common'
import { EventLogService } from './event-log.service'

/**
 * Módulo global para que cualquier módulo pueda inyectar `EventLogService`
 * sin importarlo explícitamente. Heredado D-053 mapi v0.x.
 */
@Global()
@Module({
  providers: [EventLogService],
  exports: [EventLogService],
})
export class EventLogModule {}
