import { Module } from '@nestjs/common'
import { ClientsModule } from '../11-clients/clients.module'
import { CustomerSupportDashboardController } from './customer-support/customer-support-dashboard.controller'
import { CustomerSupportDashboardRepository } from './customer-support/customer-support-dashboard.repository'
import { CustomerSupportDashboardService } from './customer-support/customer-support-dashboard.service'

/**
 * Módulo 13-views: vistas globales agregadas para el operador.
 * Renombrado desde 13-dashboards en v0.8.0 (D-mapi-019).
 *
 * Las URLs cambian a `/v1/views/<nombre>` para listas globales (cross-cliente).
 * El detalle por cliente vive en `12-customer-support/clients/` bajo
 * `/v1/clients/:id/<nombre>`.
 *
 * Hoy:
 * - customer-support/ — primera tab del dashboard home (renombrado a uncats en v0.8.0).
 *
 * Futuros: recon, w-9, 1099, mgt-report, tax-packet, qtr-payroll, property-tax.
 */
@Module({
  imports: [ClientsModule],
  controllers: [CustomerSupportDashboardController],
  providers: [CustomerSupportDashboardRepository, CustomerSupportDashboardService],
})
export class DashboardsModule {}
