import { Global, Module } from '@nestjs/common'
import { BANK_CREDENTIALS_PORT } from '@/contracts/bank-credentials.port'
import { BankPortalsRepository } from './bank-portals.repository'
import { BankCredentialsRepository } from './bank-credentials.repository'
import { BankAccountsRepository } from './bank-accounts.repository'
import { BankPortalsService } from './bank-portals.service'
import { BankCredentialsService } from './bank-credentials.service'
import { BankAccountsService } from './bank-accounts.service'
import { BankCredentialsPortAdapter } from './bank-credentials.port'
import { BankPortalsController } from './bank-portals.controller'
import { BankCredentialsController } from './bank-credentials.controller'
import { BankAccountsController } from './bank-accounts.controller'

/**
 * NestModule del plugin Bank Credentials. Consume del core (vía DI, son
 * `@Global`): `DB`, `EncryptionService`. Dueño de `bank_portals`,
 * `bank_credentials`, `bank_accounts`.
 *
 * `@Global` + export del `BANK_CREDENTIALS_PORT`: otros plugins (bank-downloader)
 * inyectan el token del core sin importar este módulo (D-core-027 / D-bank-008).
 * Solo el token sale; los servicios/repos siguen internos.
 */
@Global()
@Module({
  controllers: [BankPortalsController, BankCredentialsController, BankAccountsController],
  providers: [
    BankPortalsRepository,
    BankCredentialsRepository,
    BankAccountsRepository,
    BankPortalsService,
    BankCredentialsService,
    BankAccountsService,
    BankCredentialsPortAdapter,
    { provide: BANK_CREDENTIALS_PORT, useExisting: BankCredentialsPortAdapter },
  ],
  exports: [BANK_CREDENTIALS_PORT],
})
export class BankCredentialsModule {}
