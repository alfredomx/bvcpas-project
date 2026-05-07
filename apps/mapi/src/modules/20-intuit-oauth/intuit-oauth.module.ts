import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigModule } from '../../core/config/config.module'
import { RedisModule } from '../../core/auth/redis.module'
import { ClientsModule } from '../11-clients/clients.module'
import { ConnectionsModule } from '../21-connections/connections.module'
import { EventLogModule } from '../95-event-log/event-log.module'
import { IntuitAdminController } from './admin/intuit-admin.controller'
import { IntuitApiService } from './api-client/intuit-api.service'
import { IntuitOauthClientFactory } from './intuit-oauth-client.factory'
import { IntuitOauthController } from './oauth/intuit-oauth.controller'
import { IntuitOauthService } from './oauth/intuit-oauth.service'
import { IntuitTokensMetricsCron } from './tokens/intuit-tokens.metrics-cron'
import { IntuitTokensRepository } from './tokens/intuit-tokens.repository'
import { IntuitTokensService } from './tokens/intuit-tokens.service'

/**
 * Módulo 20-intuit-oauth: OAuth + tokens cifrados + proxy V3.
 *
 * Endpoints expuestos (todos bajo prefix global v1):
 * - POST /v1/intuit/connect — connect QBO (purpose=new-client).
 * - POST /v1/clients/:id/connect — re-conectar a cliente target.
 * - GET  /v1/intuit/callback — callback @Public de Intuit.
 * - POST /v1/intuit/:realmId/call — proxy genérico V3 (admin).
 * - GET  /v1/intuit/tokens — status de tokens sin secretos (admin).
 * - DELETE /v1/intuit/tokens/:clientId — borrar tokens (admin).
 */
@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    ClientsModule,
    ConnectionsModule,
    EventLogModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [IntuitOauthController, IntuitAdminController],
  providers: [
    IntuitOauthClientFactory,
    IntuitTokensRepository,
    IntuitTokensService,
    IntuitApiService,
    IntuitOauthService,
    IntuitTokensMetricsCron,
  ],
  exports: [IntuitTokensService, IntuitApiService],
})
export class IntuitOauthModule {}
