import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'
import { users } from './users'

/**
 * Tokens públicos genéricos por cliente. Un mismo token puede servir para
 * varios meses (reutilizable) o tener `expires_at` y/o `max_uses`.
 *
 * Hoy: 1 link reutilizable por cliente para uncats. El cliente lo recibe en
 * email y entra al formulario público. Mismo link funciona infinito (hasta
 * que se revoque).
 *
 * Mañana: encuestas, uploads de archivos, aceptación de T&C, etc. Cada
 * `purpose` define su comportamiento esperado en el frontend público.
 */
export const PUBLIC_LINK_PURPOSES = ['uncats'] as const
export type PublicLinkPurpose = (typeof PUBLIC_LINK_PURPOSES)[number]

export const clientPublicLinks = pgTable('client_public_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  purpose: text('purpose', { enum: PUBLIC_LINK_PURPOSES }).notNull(),

  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
})

export type ClientPublicLink = typeof clientPublicLinks.$inferSelect
export type NewClientPublicLink = typeof clientPublicLinks.$inferInsert
