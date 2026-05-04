import { Module } from '@nestjs/common'
import { ClientsModule } from '../11-clients/clients.module'
import { IntuitOauthModule } from '../20-intuit-oauth/intuit-oauth.module'
import { EventLogModule } from '../95-event-log/event-log.module'
import { ClientPeriodFollowupsController } from './followups/client-period-followups.controller'
import { ClientPeriodFollowupsRepository } from './followups/client-period-followups.repository'
import { ClientPeriodFollowupsService } from './followups/client-period-followups.service'
import { PublicTransactionsController } from './public/public-transactions.controller'
import { ClientPublicLinksController } from './public-links/client-public-links.controller'
import { ClientPublicLinksRepository } from './public-links/client-public-links.repository'
import { ClientPublicLinksService } from './public-links/client-public-links.service'
import { ClientTransactionResponsesController } from './responses/client-transaction-responses.controller'
import { ClientTransactionResponsesRepository } from './responses/client-transaction-responses.repository'
import { ClientTransactionResponsesService } from './responses/client-transaction-responses.service'
import { ClientTransactionsController } from './transactions/client-transactions.controller'
import { ClientTransactionsRepository } from './transactions/client-transactions.repository'
import { TransactionsSyncService } from './transactions/transactions-sync.service'

/**
 * Módulo 12-customer-support: pestaña Customer Support del dashboard.
 *
 * Snapshot uncats (volátil) + responses del cliente (persistente) + status
 * mensual + tokens públicos genéricos. Controllers admin + endpoint público
 * para que el cliente llene sin auth.
 *
 * Imports:
 *   - ClientsModule: para ClientsRepository (verificar cliente, obtener
 *     realm_id y transactions_filter).
 *   - IntuitOauthModule: para IntuitApiService (proxy V3 al sync).
 *   - EventLogModule: para auditoría.
 */
@Module({
  imports: [ClientsModule, IntuitOauthModule, EventLogModule],
  controllers: [
    ClientTransactionsController,
    ClientTransactionResponsesController,
    ClientPeriodFollowupsController,
    ClientPublicLinksController,
    PublicTransactionsController,
  ],
  providers: [
    ClientTransactionsRepository,
    TransactionsSyncService,
    ClientTransactionResponsesRepository,
    ClientTransactionResponsesService,
    ClientPeriodFollowupsRepository,
    ClientPeriodFollowupsService,
    ClientPublicLinksRepository,
    ClientPublicLinksService,
  ],
})
export class CustomerSupportModule {}
