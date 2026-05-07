import { Module } from '@nestjs/common'
import { ClientAccessGuard } from '../../core/auth/guards/client-access.guard'
import { EventLogModule } from '../95-event-log/event-log.module'
import { ClientAccessRepository } from './client-access.repository'
import { ClientsController } from './clients.controller'
import { ClientsRepository } from './clients.repository'
import { ClientsService } from './clients.service'

/**
 * Módulo 11-clients: CRUD admin de la tabla `clients`.
 *
 * Schema y migration viven en 20-intuit-oauth (v0.3.0). Aquí solo
 * agregamos endpoints HTTP, service con lógica + auditoría, y exportamos
 * `ClientsRepository` para que otros módulos lo consuman.
 *
 * v0.8.0:
 * - `ClientAccessRepository`: gestiona `user_client_access`.
 * - `ClientAccessGuard`: guard NestJS que valida acceso usando esa
 *   tabla. Cualquier módulo lo importa via `ClientsModule.exports`.
 */
@Module({
  imports: [EventLogModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService, ClientAccessRepository, ClientAccessGuard],
  exports: [ClientsRepository, ClientsService, ClientAccessRepository, ClientAccessGuard],
})
export class ClientsModule {}
