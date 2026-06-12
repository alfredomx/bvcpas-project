import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import {
  clientBankAccounts,
  type ClientBankAccount,
  type NewClientBankAccount,
} from '../../db/schema/client-bank-accounts'

@Injectable()
export class ClientBankAccountsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async listByClient(clientId: string): Promise<ClientBankAccount[]> {
    return this.db
      .select()
      .from(clientBankAccounts)
      .where(eq(clientBankAccounts.clientId, clientId))
      .orderBy(clientBankAccounts.createdAt)
  }

  async findById(id: string, clientId: string): Promise<ClientBankAccount | null> {
    const [row] = await this.db
      .select()
      .from(clientBankAccounts)
      .where(and(eq(clientBankAccounts.id, id), eq(clientBankAccounts.clientId, clientId)))
      .limit(1)
    return row ?? null
  }

  async findByClientAndPortal(
    clientId: string,
    bankPortalId: string,
  ): Promise<ClientBankAccount | null> {
    const [row] = await this.db
      .select()
      .from(clientBankAccounts)
      .where(
        and(
          eq(clientBankAccounts.clientId, clientId),
          eq(clientBankAccounts.bankPortalId, bankPortalId),
        ),
      )
      .limit(1)
    return row ?? null
  }

  async create(data: NewClientBankAccount): Promise<ClientBankAccount> {
    const [row] = await this.db.insert(clientBankAccounts).values(data).returning()
    if (!row) throw new Error('create: no row returned')
    return row
  }

  async update(
    id: string,
    clientId: string,
    patch: Partial<NewClientBankAccount>,
  ): Promise<ClientBankAccount | null> {
    const [row] = await this.db
      .update(clientBankAccounts)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(clientBankAccounts.id, id), eq(clientBankAccounts.clientId, clientId)))
      .returning()
    return row ?? null
  }

  async delete(id: string, clientId: string): Promise<boolean> {
    const result = await this.db
      .delete(clientBankAccounts)
      .where(and(eq(clientBankAccounts.id, id), eq(clientBankAccounts.clientId, clientId)))
      .returning({ id: clientBankAccounts.id })
    return result.length > 0
  }
}
