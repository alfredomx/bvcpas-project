import { Module } from '@nestjs/common'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensRepository } from './intuit-tokens.repository'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitApiService } from './intuit-api.service'

/**
 * NestModule del plugin Intuit. Consume del core (vía DI, son `@Global`):
 * `DB`, `EncryptionService`, y más adelante `ClientsService` / `REDIS_CLIENT`.
 *
 * OAuth service + controllers entran en el commit 3 de v0.1.0.
 */
@Module({
  providers: [IntuitConfigService, IntuitTokensRepository, IntuitTokensService, IntuitApiService],
  exports: [IntuitConfigService, IntuitTokensService, IntuitApiService],
})
export class IntuitModule {}
