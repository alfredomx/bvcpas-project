import { Module } from '@nestjs/common'
import { ClientsModule } from '../11-clients/clients.module'
import { CustomerSupportModule } from '../12-customer-support/customer-support.module'
import { ClientUncatsController } from './customer-support/client-uncats.controller'
import { CustomerSupportDashboardRepository } from './customer-support/customer-support-dashboard.repository'
import { CustomerSupportDashboardService } from './customer-support/customer-support-dashboard.service'
import { UncatsViewController } from './customer-support/uncats-view.controller'

/**
 * Módulo 13-views: vistas globales agregadas para el operador.
 * Renombrado desde 13-dashboards en v0.8.0 (D-mapi-019).
 *
 * Forma C de URLs:
 * - GET /v1/views/uncats          (lista global, cross-cliente)
 * - GET /v1/clients/:id/uncats    (detalle del cliente)
 *
 * Aunque el detalle vive en este mismo módulo, su path es
 * `/v1/clients/:id/uncats` (sub-recurso del cliente). El nombre del
 * recurso (`uncats`) es idéntico en ambos lados — solo cambia el scope.
 *
 * Futuras vistas siguen el mismo patrón:
 * - /v1/views/recon, /v1/views/w9, /v1/views/1099, etc.
 * - /v1/clients/:id/recon, /v1/clients/:id/w9, etc.
 */
@Module({
  imports: [ClientsModule, CustomerSupportModule],
  controllers: [UncatsViewController, ClientUncatsController],
  providers: [CustomerSupportDashboardRepository, CustomerSupportDashboardService],
})
export class DashboardsModule {}
