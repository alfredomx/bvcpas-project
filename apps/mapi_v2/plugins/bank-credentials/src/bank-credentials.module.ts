import { Module } from '@nestjs/common'
import { BankPortalsRepository } from './bank-portals.repository'
import { BankCredentialsRepository } from './bank-credentials.repository'
import { BankAccountsRepository } from './bank-accounts.repository'
import { BankPortalsService } from './bank-portals.service'
import { BankCredentialsService } from './bank-credentials.service'
import { BankAccountsService } from './bank-accounts.service'
import { BankPortalsController } from './bank-portals.controller'
import { BankCredentialsController } from './bank-credentials.controller'
import { BankAccountsController } from './bank-accounts.controller'

/**
 * NestModule del plugin Bank Credentials. Consume del core (vía DI, son
 * `@Global`): `DB`, `EncryptionService`. Dueño de `bank_portals`,
 * `bank_credentials`, `bank_accounts`.
 */
@Module({
  controllers: [BankPortalsController, BankCredentialsController, BankAccountsController],
  providers: [
    BankPortalsRepository,
    BankCredentialsRepository,
    BankAccountsRepository,
    BankPortalsService,
    BankCredentialsService,
    BankAccountsService,
  ],
})
export class BankCredentialsModule {}
