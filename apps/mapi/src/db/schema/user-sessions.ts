import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Branded types para session id y JWT id (jti). Evita confusión entre
 * el id de la sesión (PK) y el jti (claim del JWT, también UUID).
 */
export type SessionId = string & { readonly __brand: 'SessionId' }
export type SessionJti = string & { readonly __brand: 'SessionJti' }

/**
 * Sesiones de usuarios. Una row por cada login exitoso. Permite revocar
 * sesiones individualmente (logout granular, sesión robada).
 *
 * El JWT incluye el `jti` como claim. En cada request autenticado, el
 * middleware busca por `jti` para verificar que la sesión sigue activa.
 */
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jti: uuid('jti').notNull().unique(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
  }),
)

export type UserSession = typeof userSessions.$inferSelect
export type NewUserSession = typeof userSessions.$inferInsert
