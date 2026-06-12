import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import { bankAccounts, type BankAccount, type NewBankAccount } from '../../db/schema/bank-accounts'

@Injectable()
export class BankAccountsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async listByCredential(credentialId: string): Promise<BankAccount[]> {
    return this.db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.clientBankAccountId, credentialId))
      .orderBy(bankAccounts.createdAt)
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
        and(eq(bankAccounts.clientBankAccountId, credentialId), eq(bankAccounts.accountMask, mask)),
      )
      .limit(1)
    return row ?? null
  }

  async create(data: NewBankAccount): Promise<BankAccount> {
    const [row] = await this.db.insert(bankAccounts).values(data).returning()
    if (!row) throw new Error('create: no row returned')
    return row
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
    const result = await this.db
      .delete(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .returning({ id: bankAccounts.id })
    return result.length > 0
  }
}
