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

  /** Busca por la natural key. Por default ignora soft-deleted; pasar
   * `includeDeleted=true` para verlos también (caso: upsert que debe
   * detectar un response borrado y reactivarlo). */
  async findByTxn(
    clientId: string,
    realmId: string,
    qboTxnType: string,
    qboTxnId: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<ClientTransactionResponse | null> {
    const conditions = [
      eq(clientTransactionResponses.clientId, clientId),
      eq(clientTransactionResponses.realmId, realmId),
      eq(clientTransactionResponses.qboTxnType, qboTxnType),
      eq(clientTransactionResponses.qboTxnId, qboTxnId),
    ]
    if (!options.includeDeleted) {
      conditions.push(isNull(clientTransactionResponses.deletedAt))
    }
    const [row] = await this.db
      .select()
      .from(clientTransactionResponses)
      .where(and(...conditions))
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
          appendedText: data.appendedText ?? null,
          qboAccountId: data.qboAccountId ?? null,
          completed: data.completed ?? false,
          respondedAt: new Date(),
          updatedAt: new Date(),
          // Si el response estaba soft-deleted, al guardar de nuevo se reactiva
          // (transparente para frontend; no tiene que llamar restore).
          deletedAt: null,
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

  /** Lista responses de un cliente. Por default oculta soft-deleted. */
  async listByClient(
    clientId: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<ClientTransactionResponse[]> {
    const conditions = [eq(clientTransactionResponses.clientId, clientId)]
    if (!options.includeDeleted) {
      conditions.push(isNull(clientTransactionResponses.deletedAt))
    }
    return this.db
      .select()
      .from(clientTransactionResponses)
      .where(and(...conditions))
      .orderBy(desc(clientTransactionResponses.respondedAt))
  }

  async softDeleteByTxn(
    clientId: string,
    realmId: string,
    qboTxnType: string,
    qboTxnId: string,
  ): Promise<ClientTransactionResponse | null> {
    const [row] = await this.db
      .update(clientTransactionResponses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(clientTransactionResponses.clientId, clientId),
          eq(clientTransactionResponses.realmId, realmId),
          eq(clientTransactionResponses.qboTxnType, qboTxnType),
          eq(clientTransactionResponses.qboTxnId, qboTxnId),
          isNull(clientTransactionResponses.deletedAt),
        ),
      )
      .returning()
    return row ?? null
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

  async markSyncedToQbo(id: string): Promise<ClientTransactionResponse | null> {
    const [row] = await this.db
      .update(clientTransactionResponses)
      .set({ syncedToQboAt: new Date(), updatedAt: new Date() })
      .where(eq(clientTransactionResponses.id, id))
      .returning()
    return row ?? null
  }
}
