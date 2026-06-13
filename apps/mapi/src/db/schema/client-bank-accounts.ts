import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'
import { bankPortals } from './bank-portals'

/**
 * Estado operativo de la credencial del cliente en un portal bancario.
 *
 * - `active`: la credencial funciona y se usa para descarga.
 * - `blocked`: el banco bloqueó el acceso (password reset pendiente,
 *   captcha persistente, etc.). No se intenta descargar.
 * - `closed`: el cliente cerró la cuenta o ya no usa ese portal.
 */
export const CLIENT_BANK_ACCOUNT_STATUSES = ['active', 'blocked', 'closed'] as const
export type ClientBankAccountStatus = (typeof CLIENT_BANK_ACCOUNT_STATUSES)[number]

/**
 * Credenciales de un cliente para un portal bancario específico. Una fila
 * representa "Cliente X tiene login en Portal Y con estas credenciales".
 *
 * Las cuentas reales (mask + tipo) viven en la tabla `bank_accounts` con
 * FK aquí — un login puede tener N cuentas dentro (checking + savings +
 * tarjeta de crédito + ...).
 *
 * Decisión D-mapi-BW-002: credenciales encriptadas con AES-256-GCM via
 * EncryptionService. Mismo patrón que `intuit_tokens` y `user_connections`.
 * Plaintext jamás toca disco; los DTOs públicos NUNCA exponen los campos
 * `*_encrypted`.
 *
 * Decisión D-mapi-BW-004 (v0.16.4): un cliente puede tener N credenciales
 * en el mismo portal (caso real: Arcmen Engineering tiene 2 logins en
 * RBFCU, Art and Beauty Granite tiene 2 logins en RBFCU, etc.). Por eso
 * NO hay UNIQUE(client_id, bank_portal_id). Para diferenciar credenciales
 * múltiples del mismo portal se usa `nickname` (texto libre opcional).
 */
export const clientBankAccounts = pgTable('client_bank_accounts', {
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
  status: varchar('status', { length: 20, enum: CLIENT_BANK_ACCOUNT_STATUSES })
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

export type ClientBankAccount = typeof clientBankAccounts.$inferSelect
export type NewClientBankAccount = typeof clientBankAccounts.$inferInsert

/**
 * Credenciales descifradas en memoria. Lo que los adapters bancarios
 * (v0.16.0+) reciben cuando van a iniciar sesión. NUNCA se persiste ni
 * se expone vía API.
 */
export interface DecryptedClientBankAccount {
  id: string
  clientId: string
  bankPortalId: string
  nickname: string | null
  username: string
  password: string
  securityQa: string | null
  status: ClientBankAccountStatus
  notes: string | null
}
