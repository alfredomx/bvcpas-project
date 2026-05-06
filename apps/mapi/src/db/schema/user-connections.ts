import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Providers soportados. Pre-declarados todos los esperados aunque solo
 * Microsoft se implemente en v0.7.0. Cuando entre Google/Dropbox solo
 * se agrega su `<X>Provider` al `ProviderRegistry`.
 */
export const PROVIDERS = ['microsoft', 'google', 'dropbox'] as const
export type Provider = (typeof PROVIDERS)[number]

/**
 * Conexiones a servicios externos por usuario. Una fila por
 * (user, provider, cuenta-del-provider). Multi-cuenta soportado.
 *
 * Tokens cifrados con AES-256-GCM via EncryptionService. Plaintext
 * jamás toca disco.
 *
 * `external_account_id` es el id que el provider usa internamente
 * (microsoft_user_id en Graph, google sub, dropbox account_id).
 *
 * `refresh_token_encrypted` nullable: algunos providers pueden devolver
 * acceso sin refresh la primera vez. Microsoft con `offline_access`
 * siempre da uno.
 */
export const userConnections = pgTable(
  'user_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    externalAccountId: text('external_account_id').notNull(),
    email: text('email'),
    label: text('label'),
    scopes: text('scopes').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    uniqUserProviderAccount: unique('user_connections_user_provider_account_unique').on(
      t.userId,
      t.provider,
      t.externalAccountId,
    ),
  }),
)

export type UserConnection = typeof userConnections.$inferSelect
export type NewUserConnection = typeof userConnections.$inferInsert

/**
 * Conexión con plaintext, después de descifrar. Solo vive en memoria.
 */
export interface DecryptedUserConnection {
  id: string
  userId: string
  provider: Provider
  externalAccountId: string
  email: string | null
  label: string | null
  scopes: string
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date
}
