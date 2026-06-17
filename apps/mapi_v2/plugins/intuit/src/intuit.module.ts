import { Module } from '@nestjs/common'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensRepository } from './intuit-tokens.repository'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitApiService } from './intuit-api.service'
import { IntuitOauthService } from './intuit-oauth.service'
import { IntuitOauthController } from './intuit-oauth.controller'
import { IntuitAdminController } from './intuit-admin.controller'

/**
 * NestModule del plugin Intuit. Consume del core (vía DI, son `@Global`):
 * `DB`, `EncryptionService`, `REDIS_CLIENT`, `ClientsService`.
 */
@Module({
  controllers: [IntuitOauthController, IntuitAdminController],
  providers: [
    IntuitConfigService,
    IntuitTokensRepository,
    IntuitTokensService,
    IntuitApiService,
    IntuitOauthService,
  ],
  exports: [IntuitConfigService, IntuitTokensService, IntuitApiService],
})
export class IntuitModule {}
