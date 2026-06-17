import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensRepository } from './intuit-tokens.repository'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitTokensRefreshCron } from './intuit-tokens.cron'
import { IntuitApiService } from './intuit-api.service'
import { IntuitReadService } from './intuit-read.service'
import { IntuitDerivedReportsService } from './intuit-derived-reports.service'
import { IntuitOauthService } from './intuit-oauth.service'
import { IntuitOauthController } from './intuit-oauth.controller'
import { IntuitClientController } from './intuit-client.controller'
import { IntuitAdminController } from './intuit-admin.controller'
import { IntuitEntitiesController } from './intuit-entities.controller'
import { IntuitReportsController } from './intuit-reports.controller'
import { IntuitDerivedReportsController } from './intuit-derived-reports.controller'
import { IntuitDevOauthController } from './intuit-dev-oauth.controller'

/**
 * Controllers dev-only: el shortcut `/_dev/oauth/...` solo se monta fuera de
 * production (en prod la ruta no existe).
 */
const devControllers = process.env.NODE_ENV === 'production' ? [] : [IntuitDevOauthController]

/**
 * NestModule del plugin Intuit. Consume del core (vía DI, son `@Global`):
 * `DB`, `EncryptionService`, `REDIS_CLIENT`, `ClientsService`.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    IntuitOauthController,
    IntuitClientController,
    IntuitAdminController,
    IntuitEntitiesController,
    IntuitReportsController,
    IntuitDerivedReportsController,
    ...devControllers,
  ],
  providers: [
    IntuitConfigService,
    IntuitTokensRepository,
    IntuitTokensService,
    IntuitApiService,
    IntuitReadService,
    IntuitDerivedReportsService,
    IntuitOauthService,
    IntuitTokensRefreshCron,
  ],
  exports: [
    IntuitConfigService,
    IntuitTokensService,
    IntuitApiService,
    IntuitReadService,
    IntuitDerivedReportsService,
  ],
})
export class IntuitModule {}
