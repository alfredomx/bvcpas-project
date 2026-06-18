import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '@/core/db/db.module'
import { bankAccounts, type BankAccount, type NewBankAccount } from './bank-accounts.schema'

/** Acceso a datos de `bank_accounts` (cuentas individuales dentro de un login). */
@Injectable()
export class BankAccountsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async create(data: NewBankAccount): Promise<BankAccount> {
    const [row] = await this.db.insert(bankAccounts).values(data).returning()
    return row
  }

  async findById(id: string): Promise<BankAccount | null> {
    const [row] = await this.db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1)
    return row ?? null
  }

  async findByCredentialAndMask(credentialId: string, mask: string): Promise<BankAccount | null> {
    const [row] = await this.db
      .select()
      .from(bankAccounts)
      .where(
        and(eq(bankAccounts.bankCredentialId, credentialId), eq(bankAccounts.accountMask, mask)),
      )
      .limit(1)
    return row ?? null
  }

  async listByCredential(credentialId: string): Promise<BankAccount[]> {
    return this.db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.bankCredentialId, credentialId))
      .orderBy(bankAccounts.accountMask)
  }

  async update(id: string, patch: Partial<NewBankAccount>): Promise<BankAccount | null> {
    const [row] = await this.db
      .update(bankAccounts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(bankAccounts.id, id))
      .returning()
    return row ?? null
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .returning({ id: bankAccounts.id })
    return rows.length > 0
  }
}
