import { Global, Module } from '@nestjs/common'
import { AppConfigService } from '../config/config.service'
import { EncryptionService, encryptionServiceFactory } from './encryption.service'

/**
 * Cifra/descifra strings con AES-256-GCM. Global porque varios módulos
 * (intuit-oauth, futuros connectors) lo necesitan.
 */
@Global()
@Module({
  providers: [
    {
      provide: EncryptionService,
      inject: [AppConfigService],
      useFactory: encryptionServiceFactory,
    },
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
