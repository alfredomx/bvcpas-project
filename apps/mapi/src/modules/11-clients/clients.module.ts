import { Module } from '@nestjs/common'
import { EventLogModule } from '../95-event-log/event-log.module'
import { ClientsController } from './clients.controller'
import { ClientsRepository } from './clients.repository'
import { ClientsService } from './clients.service'

/**
 * Módulo 11-clients: CRUD admin de la tabla `clients`.
 *
 * Schema y migration viven en 20-intuit-oauth (v0.3.0). Aquí solo
 * agregamos endpoints HTTP, service con lógica + auditoría, y exportamos
 * `ClientsRepository` para que 20-intuit-oauth lo consuma en el flow OAuth.
 */
@Module({
  imports: [EventLogModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService],
  exports: [ClientsRepository, ClientsService],
})
export class ClientsModule {}
