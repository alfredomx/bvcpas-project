import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'

/**
 * Tokens OAuth de Intuit por cliente. Una fila por cliente conectado.
 *
 * Ambos tokens (access + refresh) se guardan cifrados con AES-256-GCM
 * (formato `iv:ciphertext:authTag` base64). Los plaintext NUNCA tocan disco.
 *
 * `client_id` es PK directamente (heredado D-mapi-v0.x-085): la relación
 * entre cliente y tokens es 1:1 estricta. Hacer `client_id` la PK elimina
 * una columna y un índice UNIQUE redundante.
 *
 * ON DELETE CASCADE: si se borra el cliente, sus tokens se borran también.
 */
export const intuitTokens = pgTable('intuit_tokens', {
  clientId: uuid('client_id')
    .primaryKey()
    .references(() => clients.id, { onDelete: 'cascade' }),
  realmId: text('realm_id').notNull().unique(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }).notNull(),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type IntuitToken = typeof intuitTokens.$inferSelect
export type NewIntuitToken = typeof intuitTokens.$inferInsert

/**
 * Token con plaintext, después de descifrar. Solo vive en memoria; nunca
 * se persiste así.
 */
export interface DecryptedIntuitToken {
  clientId: string
  realmId: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}
