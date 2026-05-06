import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Tokens OAuth de Microsoft Graph por usuario. Una fila por usuario
 * conectado. Mismo patrón que intuit_tokens: ambos tokens cifrados con
 * AES-256-GCM (formato `iv:ciphertext:authTag` base64). Plaintext jamás
 * toca disco.
 *
 * `user_id` es PK directamente: la relación user→Outlook es 1:1 estricta.
 * ON DELETE CASCADE: si se borra el user, sus tokens se borran también.
 *
 * `microsoft_user_id` es el `id` de Graph (`/me`), no el email. Permite
 * detectar si el usuario reconecta con la misma cuenta o con otra
 * distinta.
 *
 * Microsoft no expone `refresh_token_expires_at`: el refresh_token de
 * Microsoft no caduca por TTL fijo, expira por inactividad (~90 días sin
 * uso) o revocación manual. Por eso esa columna no existe aquí.
 */
export const userMicrosoftTokens = pgTable('user_microsoft_tokens', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  microsoftUserId: text('microsoft_user_id').notNull().unique(),
  email: text('email').notNull(),
  scopes: text('scopes').notNull(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type UserMicrosoftToken = typeof userMicrosoftTokens.$inferSelect
export type NewUserMicrosoftToken = typeof userMicrosoftTokens.$inferInsert

/**
 * Token con plaintext, después de descifrar. Solo vive en memoria; nunca
 * se persiste así.
 */
export interface DecryptedUserMicrosoftToken {
  userId: string
  microsoftUserId: string
  email: string
  scopes: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
}
