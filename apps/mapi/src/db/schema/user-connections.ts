import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { clients } from './clients'

/**
 * Providers soportados. v0.8.0 agrega 'intuit' (migrado desde
 * intuit_tokens). Cuando entre Google/Dropbox se agrega su
 * `<X>Provider` al `ProviderRegistry` sin tocar este enum.
 */
export const PROVIDERS = ['intuit', 'microsoft', 'google', 'dropbox', 'clover'] as const
export type Provider = (typeof PROVIDERS)[number]

/**
 * Mecanismo de autenticación de la conexión:
 * - 'oauth': flow estándar con access_token + refresh_token (Microsoft,
 *   Intuit, Dropbox, Google).
 * - 'api_key': credenciales estáticas que el merchant genera manualmente
 *   en su dashboard del provider. Sin refresh — el token vive hasta que
 *   el merchant lo revoque. Ej: Clover api_token + merchant_id.
 */
export const AUTH_TYPES = ['oauth', 'api_key'] as const
export type AuthType = (typeof AUTH_TYPES)[number]

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
    // v0.11.0: distingue OAuth de api_key. Default 'oauth' para retrocompat
    // con las 8 conexiones existentes (Microsoft, Intuit, Dropbox, Google).
    authType: text('auth_type').notNull().default('oauth'),
    email: text('email'),
    label: text('label'),
    // OAuth fields — nullable cuando auth_type='api_key'.
    scopes: text('scopes'),
    accessTokenEncrypted: text('access_token_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    // api_key field — JSON cifrado con la shape específica del provider
    // (ej. Clover: `{api_token, merchant_id}`).
    credentialsEncrypted: text('credentials_encrypted'),
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
 * Conexión OAuth descifrada (Microsoft, Intuit, Dropbox, Google, etc.).
 * Es lo que `IProvider.refresh/test/getProfile` reciben. Plaintext en
 * memoria — nunca se persiste.
 *
 * Las conexiones api_key NO usan este tipo; tienen su propio
 * `DecryptedApiKeyConnection` (nombre del campo `credentials`).
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

/**
 * Conexión api_key descifrada (Clover token-manual, Gemini, etc.).
 * `credentials` es JSON con shape específico del provider:
 *  - Clover: `{ api_token: string, merchant_id: string }`
 *  - Gemini (futuro): `{ api_key: string }`
 *
 * No tiene refresh_token ni access_token — es credencial estática.
 */
export interface DecryptedApiKeyConnection {
  id: string
  userId: string
  provider: Provider
  externalAccountId: string
  clientId: string | null
  scopeType: ScopeType
  email: string | null
  label: string | null
  credentials: Record<string, unknown>
}
