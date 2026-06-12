import { Module } from '@nestjs/common'
import { ClientsModule } from '../11-clients/clients.module'
import { EventLogModule } from '../95-event-log/event-log.module'
import { EncryptionModule } from '../../core/encryption/encryption.module'
import { BankPortalsController } from './bank-portals.controller'
import { BankPortalsRepository } from './bank-portals.repository'
import { BankPortalsService } from './bank-portals.service'
import { ClientBankAccountsController } from './client-bank-accounts.controller'
import { ClientBankAccountsRepository } from './client-bank-accounts.repository'
import { ClientBankAccountsService } from './client-bank-accounts.service'
import { BankAccountsController } from './bank-accounts.controller'
import { BankAccountsRepository } from './bank-accounts.repository'
import { BankAccountsService } from './bank-accounts.service'
import { BankCredentialsGlobalController } from './bank-credentials-global.controller'

@Module({
  imports: [ClientsModule, EventLogModule, EncryptionModule],
  controllers: [
    BankPortalsController,
    ClientBankAccountsController,
    BankAccountsController,
    BankCredentialsGlobalController,
  ],
  providers: [
    BankPortalsRepository,
    BankPortalsService,
    ClientBankAccountsRepository,
    ClientBankAccountsService,
    BankAccountsRepository,
    BankAccountsService,
  ],
})
export class BankWorkerModule {}
