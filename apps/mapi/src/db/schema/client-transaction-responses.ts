import { date, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'
import { CLIENT_TRANSACTION_CATEGORIES } from './client-transactions'

/**
 * Respuestas del cliente a las transacciones (notas que escribió en el
 * formulario público). Persistente — nunca se borra automáticamente. El
 * operador hace TRUNCATE/DELETE manual al inicio de cada año.
 *
 * Una sola respuesta por transacción: si el cliente edita su nota, se hace
 * UPDATE del row existente (decisión D-mapi-cs-001). Si necesitamos historial
 * de revisiones después, se agrega tabla `client_transaction_response_history`.
 *
 * Snapshot inline de los datos de la transacción: `vendor_name`, `memo`, etc.
 * se copian al guardar la respuesta. Razón: la tabla `client_transactions` es
 * volátil; si después de que el cliente respondió hacemos nuevo sync y la
 * transacción ya no aparece (porque el contador la categorizó), perderíamos
 * el contexto sin este snapshot.
 *
 * UNIQUE por `(client_id, realm_id, qbo_txn_type, qbo_txn_id)` para garantizar
 * 1 respuesta por transacción.
 */
export const clientTransactionResponses = pgTable(
  'client_transaction_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    realmId: text('realm_id').notNull(),
    qboTxnType: text('qbo_txn_type').notNull(),
    qboTxnId: text('qbo_txn_id').notNull(),

    // Snapshot inline de los datos al momento de responder.
    txnDate: date('txn_date', { mode: 'string' }).notNull(),
    vendorName: text('vendor_name'),
    memo: text('memo'),
    splitAccount: text('split_account'),
    category: text('category', { enum: CLIENT_TRANSACTION_CATEGORIES }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),

    // Respuesta del cliente:
    clientNote: text('client_note').notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    // Writeback a QBO (futuro):
    syncedToQboAt: timestamp('synced_to_qbo_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    uniqueByTxn: uniqueIndex('client_transaction_responses_unique_idx').on(
      table.clientId,
      table.realmId,
      table.qboTxnType,
      table.qboTxnId,
    ),
  }),
)

export type ClientTransactionResponse = typeof clientTransactionResponses.$inferSelect
export type NewClientTransactionResponse = typeof clientTransactionResponses.$inferInsert
