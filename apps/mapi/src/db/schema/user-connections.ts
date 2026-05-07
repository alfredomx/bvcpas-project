import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { clients } from './clients'

/**
 * Providers soportados. v0.8.0 agrega 'intuit' (migrado desde
 * intuit_tokens). Cuando entre Google/Dropbox se agrega su
 * `<X>Provider` al `ProviderRegistry` sin tocar este enum.
 */
export const PROVIDERS = ['intuit', 'microsoft', 'google', 'dropbox'] as const
export type Provider = (typeof PROVIDERS)[number]

/**
 * `scope_type` distingue conexiones globales (compartidas, solo lectura)
 * de personales (full access). Aplica principalmente a Intuit hoy:
 * - 'readonly': cuenta global compartida (ej. customer-service@bv-cpas.com)
 *   que cualquier operador puede consumir para leer.
 * - 'full': conexión personal del operador, usada para escribir y dejar
 *   firma en QBO.
 *
 * Microsoft conexiones son siempre 'full' (por user, no compartidas).
 */
export const SCOPE_TYPES = ['full', 'readonly'] as const
export type ScopeType = (typeof SCOPE_TYPES)[number]

/**
 * Conexiones a servicios externos. Una fila por
 * (user, provider, cuenta-del-provider). Multi-cuenta soportado vía
 * UNIQUE compuesto.
 *
 * Tokens cifrados con AES-256-GCM via EncryptionService. Plaintext
 * jamás toca disco.
 *
 * `external_account_id` es el id que el provider usa internamente
 * (microsoft_user_id en Graph, realm_id en Intuit, google sub, etc.).
 *
 * `client_id` solo aplica a providers cuya conexión apunta a un cliente
 * contable (Intuit). Para providers por user (Microsoft, Google, Dropbox)
 * queda NULL.
 *
 * `refresh_token_encrypted` nullable: algunos providers pueden devolver
 * acceso sin refresh la primera vez. Microsoft con `offline_access`
 * siempre da uno; Intuit también.
 *
 * `refresh_token_expires_at` nullable: Intuit lo expone (~100 días),
 * Microsoft no (lo gestiona internamente, expira por inactividad).
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
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    scopeType: text('scope_type').notNull().default('full'),
    email: text('email'),
    label: text('label'),
    scopes: text('scopes').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
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
  clientId: string | null
  scopeType: ScopeType
  email: string | null
  label: string | null
  scopes: string
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date | null
}
