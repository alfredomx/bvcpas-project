import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import { bankPortals, type BankPortal, type NewBankPortal } from '../../db/schema/bank-portals'
import { clientBankAccounts } from '../../db/schema/client-bank-accounts'

@Injectable()
export class BankPortalsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async listAll(): Promise<BankPortal[]> {
    return this.db.select().from(bankPortals).orderBy(bankPortals.name)
  }

  async findById(id: string): Promise<BankPortal | null> {
    const [row] = await this.db.select().from(bankPortals).where(eq(bankPortals.id, id)).limit(1)
    return row ?? null
  }

  async findByName(name: string): Promise<BankPortal | null> {
    const [row] = await this.db
      .select()
      .from(bankPortals)
      .where(eq(bankPortals.name, name))
      .limit(1)
    return row ?? null
  }

  async create(data: NewBankPortal): Promise<BankPortal> {
    const [row] = await this.db.insert(bankPortals).values(data).returning()
    if (!row) throw new Error('create: no row returned')
    return row
  }

  async update(id: string, patch: Partial<NewBankPortal>): Promise<BankPortal | null> {
    const [row] = await this.db
      .update(bankPortals)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(bankPortals.id, id))
      .returning()
    return row ?? null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(bankPortals)
      .where(eq(bankPortals.id, id))
      .returning({ id: bankPortals.id })
    return result.length > 0
  }

  async hasCredentials(portalId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: clientBankAccounts.id })
      .from(clientBankAccounts)
      .where(eq(clientBankAccounts.bankPortalId, portalId))
      .limit(1)
    return !!row
  }
}
