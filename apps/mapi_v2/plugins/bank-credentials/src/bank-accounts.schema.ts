import { pgTable, uuid, text, varchar, timestamp, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { bankCredentials } from './bank-credentials.schema'

/** Tipo de cuenta individual dentro de un login. */
export const BANK_ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'loan', 'other'] as const
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number]

/**
 * Estado de una cuenta individual.
 * - `active`: abierta, se incluye en descargas.
 * - `closed`: cerrada; se mantiene por historial, no se descarga.
 * - `blocked`: temporalmente fuera (dispute, congelada).
 */
export const BANK_ACCOUNT_STATUSES = ['active', 'closed', 'blocked'] as const
export type BankAccountStatus = (typeof BANK_ACCOUNT_STATUSES)[number]

/**
 * Cuenta bancaria individual dentro de un login. Un `bank_credentials` puede
 * contener N cuentas (checking + savings + tarjeta + ...).
 *
 * `account_mask` = últimos 4 dígitos visibles en el portal (suficiente para
 * identificar sin guardar el número completo). FK `bank_credential_id`
 * (renombre del `client_bank_account_id` viejo, al renombrarse el padre).
 *
 * UNIQUE (bank_credential_id, account_mask): dentro de un login no hay dos
 * cuentas con el mismo mask; logins distintos sí pueden compartir mask.
 */
export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankCredentialId: uuid('bank_credential_id')
      .notNull()
      .references(() => bankCredentials.id, { onDelete: 'cascade' }),
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
    uniqCredentialMask: unique('bank_accounts_credential_mask_unique').on(
      t.bankCredentialId,
      t.accountMask,
    ),
  }),
)

export type BankAccount = typeof bankAccounts.$inferSelect
export type NewBankAccount = typeof bankAccounts.$inferInsert
