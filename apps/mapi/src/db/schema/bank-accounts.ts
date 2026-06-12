import { pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clientBankAccounts } from './client-bank-accounts'

/**
 * Tipo de cuenta bancaria individual dentro de un login.
 *
 * - `checking`: cuenta corriente.
 * - `savings`: cuenta de ahorros.
 * - `credit_card`: tarjeta de crédito.
 * - `loan`: préstamo / línea de crédito.
 * - `other`: casos no estándar (CD, money market, etc.). Se agrega cuando
 *   aparezca un tipo con demanda operativa real.
 */
export const BANK_ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'loan', 'other'] as const
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number]

/**
 * Estado operativo de una cuenta individual.
 *
 * - `active`: la cuenta está abierta y se incluye en descargas.
 * - `closed`: la cuenta fue cerrada. Se mantiene la fila por historial
 *   pero no se descarga.
 * - `blocked`: temporalmente fuera de operación (dispute, congelada).
 */
export const BANK_ACCOUNT_STATUSES = ['active', 'closed', 'blocked'] as const
export type BankAccountStatus = (typeof BANK_ACCOUNT_STATUSES)[number]

/**
 * Cuenta bancaria individual dentro del login de un cliente. Un login
 * (`client_bank_accounts`) puede contener N cuentas reales (checking,
 * savings, credit card, etc.).
 *
 * Esta tabla NO se popula en el seed inicial (v0.15.0). Las filas se
 * agregan después manualmente desde la web — el operador inicia sesión
 * en el banco, ve los masks reales y los registra uno por uno.
 *
 * `account_mask` = últimos 4 dígitos visibles en el portal del banco.
 * Suficiente para identificar la cuenta sin guardar el número completo.
 *
 * UNIQUE `(client_bank_account_id, account_mask)`: dentro de un mismo
 * login no puede haber dos cuentas con el mismo mask. Distintos logins
 * sí pueden compartir mask (el mask por sí solo no es único globalmente).
 */
export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientBankAccountId: uuid('client_bank_account_id')
      .notNull()
      .references(() => clientBankAccounts.id, { onDelete: 'cascade' }),
    accountMask: varchar('account_mask', { length: 4 }).notNull(),
    accountType: varchar('account_type', { length: 20, enum: BANK_ACCOUNT_TYPES }).notNull(),
    label: text('label'),
    status: varchar('status', { length: 20, enum: BANK_ACCOUNT_STATUSES })
      .notNull()
      .default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    uniqLoginMask: unique('bank_accounts_login_mask_unique').on(
      t.clientBankAccountId,
      t.accountMask,
    ),
  }),
)

export type BankAccount = typeof bankAccounts.$inferSelect
export type NewBankAccount = typeof bankAccounts.$inferInsert
