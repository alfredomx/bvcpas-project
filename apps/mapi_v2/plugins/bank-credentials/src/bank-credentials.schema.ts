import { pgTable, uuid, text, varchar, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from '@/core/db/schema/clients'
import { bankPortals } from './bank-portals.schema'

/**
 * Estado operativo de la credencial de un cliente en un portal.
 * - `active`: el login funciona y se usa.
 * - `blocked`: el banco bloqueó el acceso (reset pendiente, captcha, etc.).
 * - `closed`: el cliente cerró la cuenta o ya no usa ese portal.
 */
export const BANK_CREDENTIAL_STATUSES = ['active', 'blocked', 'closed'] as const
export type BankCredentialStatus = (typeof BANK_CREDENTIAL_STATUSES)[number]

/**
 * El LOGIN de un cliente en un portal bancario (renombre del confuso
 * `client_bank_accounts` del mapi viejo: esto es la credencial, NO una cuenta
 * bancaria — las cuentas reales viven en `bank_accounts`).
 *
 * Llaveada por `client_id` (FK → core `clients`, modelo WordPress). Secretos
 * cifrados con el `EncryptionService` del core (`iv:authTag:ciphertext`, mismo
 * formato que `intuit_tokens` → la migración del prod viejo los descifra con la
 * llave vieja y los re-cifra con la nueva, D-bank-005).
 *
 * SIN unique(client_id, bank_portal_id): un cliente puede tener N logins en el
 * mismo portal (caso real del mapi viejo); se distinguen por `nickname`.
 */
export const bankCredentials = pgTable('bank_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  bankPortalId: uuid('bank_portal_id')
    .notNull()
    .references(() => bankPortals.id, { onDelete: 'restrict' }),
  nickname: text('nickname'),
  usernameEncrypted: text('username_encrypted'),
  passwordEncrypted: text('password_encrypted'),
  securityQaEncrypted: text('security_qa_encrypted'),
  status: varchar('status', { length: 20, enum: BANK_CREDENTIAL_STATUSES })
    .notNull()
    .default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type BankCredential = typeof bankCredentials.$inferSelect
export type NewBankCredential = typeof bankCredentials.$inferInsert
