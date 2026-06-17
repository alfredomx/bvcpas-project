import { Global, Module } from '@nestjs/common'
import { AppConfigService } from '@/core/config/config.service'
import { EncryptionService, encryptionServiceFactory } from './encryption.service'

/**
 * Cifra/descifra strings con AES-256-GCM. `@Global` porque varios plugins lo
 * van a necesitar (intuit tokens, bancos, api-keys). Cripto = infra del core.
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
