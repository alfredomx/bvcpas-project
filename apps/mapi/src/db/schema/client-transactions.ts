import { date, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'

/**
 * Categorías de transacciones que el sistema de Customer Support maneja.
 *
 * - `uncategorized_expense`: bookkeeper no sabe a qué categoría va. Se manda al cliente.
 * - `uncategorized_income`: ingreso sin categoría. Se manda al cliente.
 * - `ask_my_accountant`: el bookkeeper pide a un contador interno. NO va al cliente.
 *
 * Heredado del filtro del reporte TransactionList de Intuit:
 *   /uncategorized (expense|income)|suspense|ask/i sobre ColData[7].
 *
 * `suspense` se mapea a `uncategorized_expense` o `uncategorized_income` según
 * el tipo de transacción (Deposit → income, resto → expense). Ese mapeo lo
 * hace el classifier en `transactions-sync.service.ts`.
 */
export const CLIENT_TRANSACTION_CATEGORIES = [
  'uncategorized_expense',
  'uncategorized_income',
  'ask_my_accountant',
] as const
export type ClientTransactionCategory = (typeof CLIENT_TRANSACTION_CATEGORIES)[number]

/**
 * Snapshot volátil del último sync con Intuit. Cada `POST /sync` borra todo el
 * rango y vuelve a INSERT — no preserva nada local.
 *
 * Las respuestas del cliente viven en `client_transaction_responses`, NO aquí.
 *
 * PK compuesta `(realm_id, qbo_txn_type, qbo_txn_id)`: identificador natural de
 * QBO. Sin UUID interno porque la tabla es desechable; cuando se borra el row
 * no hay FKs que rompamos.
 */
export const clientTransactions = pgTable(
  'client_transactions',
  {
    realmId: text('realm_id').notNull(),
    qboTxnType: text('qbo_txn_type').notNull(), // 'Expense', 'Deposit', 'Check', 'Bill', 'JournalEntry', 'Transfer'...
    qboTxnId: text('qbo_txn_id').notNull(),

    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    txnDate: date('txn_date', { mode: 'string' }).notNull(),
    docnum: text('docnum'),
    vendorName: text('vendor_name'),
    memo: text('memo'),
    splitAccount: text('split_account'),
    category: text('category', { enum: CLIENT_TRANSACTION_CATEGORIES }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),

    syncedAt: timestamp('synced_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.realmId, table.qboTxnType, table.qboTxnId] }),
  }),
)

export type ClientTransaction = typeof clientTransactions.$inferSelect
export type NewClientTransaction = typeof clientTransactions.$inferInsert
