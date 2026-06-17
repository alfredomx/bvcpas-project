import { Module } from '@nestjs/common'
import { IntuitConfigService } from './intuit.config'

/**
 * NestModule del plugin Intuit. Por ahora (setup) solo provee la config.
 * El repo de tokens, IntuitApiService, OAuth service y controllers entran en
 * los siguientes commits de v0.1.0.
 *
 * Consume del core (vía DI): ClientsService, EncryptionService, REDIS_CLIENT,
 * AppConfigService. Nunca toca entrañas del core ni de otro plugin.
 */
@Module({
  providers: [IntuitConfigService],
  exports: [IntuitConfigService],
})
export class IntuitModule {}
