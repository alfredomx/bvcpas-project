import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from '@/core/db/schema/clients'

/**
 * Tabla del plugin Intuit: la conexión QBO de un cliente.
 *
 * Llaveada por `client_id` (FK → core `clients`, modelo WordPress: el plugin
 * extiende la entidad central con su propia tabla). 1 conexión por cliente
 * (D-intuit-003). Importar `clients` aquí es SOLO para el FK (acoplamiento de
 * modelo de datos, intencional) — no es "reach" a la lógica del core.
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
  // true cuando el último refresh falló (refresh vencido o Intuit lo rechazó):
  // la conexión necesita re-OAuth. Se limpia (false) en cada save/refresh exitoso.
  needsReauth: boolean('needs_reauth').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type IntuitTokens = typeof intuitTokens.$inferSelect
export type NewIntuitTokens = typeof intuitTokens.$inferInsert
