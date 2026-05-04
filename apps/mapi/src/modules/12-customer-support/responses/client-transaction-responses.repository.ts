import { Inject, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import {
  type ClientTransactionResponse,
  type NewClientTransactionResponse,
  clientTransactionResponses,
} from '../../../db/schema/client-transaction-responses'

@Injectable()
export class ClientTransactionResponsesRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findByTxn(
    clientId: string,
    realmId: string,
    qboTxnType: string,
    qboTxnId: string,
  ): Promise<ClientTransactionResponse | null> {
    const [row] = await this.db
      .select()
      .from(clientTransactionResponses)
      .where(
        and(
          eq(clientTransactionResponses.clientId, clientId),
          eq(clientTransactionResponses.realmId, realmId),
          eq(clientTransactionResponses.qboTxnType, qboTxnType),
          eq(clientTransactionResponses.qboTxnId, qboTxnId),
        ),
      )
      .limit(1)
    return row ?? null
  }

  async upsert(data: NewClientTransactionResponse): Promise<ClientTransactionResponse> {
    const [row] = await this.db
      .insert(clientTransactionResponses)
      .values(data)
      .onConflictDoUpdate({
        target: [
          clientTransactionResponses.clientId,
          clientTransactionResponses.realmId,
          clientTransactionResponses.qboTxnType,
          clientTransactionResponses.qboTxnId,
        ],
        set: {
          clientNote: data.clientNote,
          respondedAt: new Date(),
          updatedAt: new Date(),
          // Refrescamos también el snapshot inline por si la transacción cambió
          // entre la primera respuesta y la edición.
          txnDate: data.txnDate,
          vendorName: data.vendorName ?? null,
          memo: data.memo ?? null,
          splitAccount: data.splitAccount ?? null,
          category: data.category,
          amount: data.amount,
        },
      })
      .returning()
    if (!row) throw new Error('upsert: no row returned')
    return row
  }

  async listByClient(clientId: string): Promise<ClientTransactionResponse[]> {
    return this.db
      .select()
      .from(clientTransactionResponses)
      .where(eq(clientTransactionResponses.clientId, clientId))
      .orderBy(desc(clientTransactionResponses.respondedAt))
  }

  async listPendingWriteback(clientId: string): Promise<ClientTransactionResponse[]> {
    return this.db
      .select()
      .from(clientTransactionResponses)
      .where(
        and(
          eq(clientTransactionResponses.clientId, clientId),
          isNull(clientTransactionResponses.syncedToQboAt),
        ),
      )
      .orderBy(asc(clientTransactionResponses.txnDate))
  }

  async markSyncedToQbo(id: string): Promise<void> {
    await this.db
      .update(clientTransactionResponses)
      .set({ syncedToQboAt: new Date(), updatedAt: new Date() })
      .where(eq(clientTransactionResponses.id, id))
  }
}
