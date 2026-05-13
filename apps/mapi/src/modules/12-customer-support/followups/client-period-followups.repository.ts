import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import {
  type ClientPeriodFollowup,
  type NewClientPeriodFollowup,
  clientPeriodFollowups,
} from '../../../db/schema/client-period-followups'

@Injectable()
export class ClientPeriodFollowupsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findByClientAndPeriod(
    clientId: string,
    period: string,
  ): Promise<ClientPeriodFollowup | null> {
    const [row] = await this.db
      .select()
      .from(clientPeriodFollowups)
      .where(
        and(eq(clientPeriodFollowups.clientId, clientId), eq(clientPeriodFollowups.period, period)),
      )
      .limit(1)
    return row ?? null
  }

  async upsert(data: NewClientPeriodFollowup): Promise<ClientPeriodFollowup> {
    const [row] = await this.db
      .insert(clientPeriodFollowups)
      .values(data)
      .onConflictDoUpdate({
        target: [clientPeriodFollowups.clientId, clientPeriodFollowups.period],
        set: {
          status: data.status,
          sentAt: data.sentAt ?? null,
          lastReplyAt: data.lastReplyAt ?? null,
          lastFullyRespondedAt: data.lastFullyRespondedAt ?? null,
          sentByUserId: data.sentByUserId ?? null,
          internalNotes: data.internalNotes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error('upsert: no row returned')
    return row
  }

  /**
   * Recalcula si el cliente está al 100% de uncats respondidas en el período
   * dado. Si lo está, actualiza `last_fully_responded_at = NOW()`.
   *
   * Si no está al 100%, NO toca el campo (queda como marca histórica del
   * último día limpio).
   *
   * Si no existe la fila del período, NO la crea: el helper solo aplica
   * cuando ya hay registro de followup.
   *
   * Cuenta: uncats activas en el período = COUNT(client_transactions WHERE
   * category IN ('uncategorized_expense','uncategorized_income') AND
   * txn_date está en el período).
   * Responses: COUNT(client_transaction_responses WHERE completed=true AND
   * deleted_at IS NULL AND category IN (...) AND txn_date está en el
   * período).
   */
  async maybeMarkFullyResponded(clientId: string, period: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE client_period_followups f
      SET last_fully_responded_at = NOW(),
          updated_at = NOW()
      WHERE f.client_id = ${clientId}::uuid
        AND f.period = ${period}
        AND (
          SELECT COUNT(*) FROM client_transactions t
          WHERE t.client_id = ${clientId}::uuid
            AND t.category IN ('uncategorized_expense', 'uncategorized_income')
            AND TO_CHAR(t.txn_date, 'YYYY-MM') = ${period}
        ) > 0
        AND (
          SELECT COUNT(*) FROM client_transactions t
          WHERE t.client_id = ${clientId}::uuid
            AND t.category IN ('uncategorized_expense', 'uncategorized_income')
            AND TO_CHAR(t.txn_date, 'YYYY-MM') = ${period}
        ) <= (
          SELECT COUNT(*) FROM client_transaction_responses r
          WHERE r.client_id = ${clientId}::uuid
            AND r.completed = true
            AND r.deleted_at IS NULL
            AND r.category IN ('uncategorized_expense', 'uncategorized_income')
            AND TO_CHAR(r.txn_date, 'YYYY-MM') = ${period}
        )
    `)
    const rowCount = (result as unknown as { count?: number }).count ?? 0
    return rowCount > 0
  }
}
