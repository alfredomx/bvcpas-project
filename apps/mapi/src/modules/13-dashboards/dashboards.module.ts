import { Module } from '@nestjs/common'
import { ClientsModule } from '../11-clients/clients.module'
import { CustomerSupportDashboardController } from './customer-support/customer-support-dashboard.controller'
import { CustomerSupportDashboardRepository } from './customer-support/customer-support-dashboard.repository'
import { CustomerSupportDashboardService } from './customer-support/customer-support-dashboard.service'

/**
 * Módulo 13-dashboards: aloja endpoints custom de pantallas del operador.
 *
 * Convención: 1 sub-carpeta por dashboard. Cada dashboard expone endpoints
 * `GET /v1/dashboards/<nombre>` (lista) y opcionalmente `GET /v1/dashboards/
 * <nombre>/:clientId` (detalle).
 *
 * Hoy:
 * - customer-support/ — primera tab del dashboard home.
 *
 * Futuros: reconciliations, w-9, 1099, mgt-report, tax-packet, qtr-payroll,
 * property-tax. Cada uno suma su sub-carpeta + 1-2 endpoints.
 */
@Module({
  imports: [ClientsModule],
  controllers: [CustomerSupportDashboardController],
  providers: [CustomerSupportDashboardRepository, CustomerSupportDashboardService],
})
export class DashboardsModule {}
