import { Inject, Injectable } from '@nestjs/common'
import { and, asc, between, eq, type SQL } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import {
  type ClientTransaction,
  type ClientTransactionCategory,
  type NewClientTransaction,
  clientTransactions,
} from '../../../db/schema/client-transactions'

export interface ListTransactionsFilters {
  clientId: string
  category?: ClientTransactionCategory
  startDate?: string
  endDate?: string
}

@Injectable()
export class ClientTransactionsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async deleteByClientAndDateRange(
    clientId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const deleted = await this.db
      .delete(clientTransactions)
      .where(
        and(
          eq(clientTransactions.clientId, clientId),
          between(clientTransactions.txnDate, startDate, endDate),
        ),
      )
      .returning({ qboTxnId: clientTransactions.qboTxnId })
    return deleted.length
  }

  async insertMany(rows: NewClientTransaction[]): Promise<number> {
    if (rows.length === 0) return 0
    const inserted = await this.db
      .insert(clientTransactions)
      .values(rows)
      .returning({ qboTxnId: clientTransactions.qboTxnId })
    return inserted.length
  }

  async list(filters: ListTransactionsFilters): Promise<ClientTransaction[]> {
    const conditions: SQL[] = [eq(clientTransactions.clientId, filters.clientId)]
    if (filters.category) {
      conditions.push(eq(clientTransactions.category, filters.category))
    }
    if (filters.startDate && filters.endDate) {
      conditions.push(between(clientTransactions.txnDate, filters.startDate, filters.endDate))
    }
    return this.db
      .select()
      .from(clientTransactions)
      .where(and(...conditions))
      .orderBy(asc(clientTransactions.txnDate))
  }

  async deleteById(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(clientTransactions)
      .where(eq(clientTransactions.id, id))
      .returning({ id: clientTransactions.id })
    return deleted.length > 0
  }

  async findById(id: string): Promise<ClientTransaction | null> {
    const [row] = await this.db
      .select()
      .from(clientTransactions)
      .where(eq(clientTransactions.id, id))
      .limit(1)
    return row ?? null
  }
}
