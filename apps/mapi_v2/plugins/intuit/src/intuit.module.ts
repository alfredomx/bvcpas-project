import { Module } from '@nestjs/common'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensRepository } from './intuit-tokens.repository'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitApiService } from './intuit-api.service'
import { IntuitReadService } from './intuit-read.service'
import { IntuitOauthService } from './intuit-oauth.service'
import { IntuitOauthController } from './intuit-oauth.controller'
import { IntuitAdminController } from './intuit-admin.controller'
import { IntuitEntitiesController } from './intuit-entities.controller'
import { IntuitReportsController } from './intuit-reports.controller'

/**
 * NestModule del plugin Intuit. Consume del core (vía DI, son `@Global`):
 * `DB`, `EncryptionService`, `REDIS_CLIENT`, `ClientsService`.
 */
@Module({
  controllers: [
    IntuitOauthController,
    IntuitAdminController,
    IntuitEntitiesController,
    IntuitReportsController,
  ],
  providers: [
    IntuitConfigService,
    IntuitTokensRepository,
    IntuitTokensService,
    IntuitApiService,
    IntuitReadService,
    IntuitOauthService,
  ],
  exports: [IntuitConfigService, IntuitTokensService, IntuitApiService, IntuitReadService],
})
export class IntuitModule {}
