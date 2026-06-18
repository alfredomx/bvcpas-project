import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Catálogo abierto de portales bancarios. Cada fila = un banco / institución
 * que algún cliente del despacho usa. Es GLOBAL (compartido entre clientes),
 * NO cuelga de `client_id` — por eso vive aparte y sus rutas no llevan cliente
 * (D-bank-003). `name` único: no hay dos portales con el mismo nombre.
 *
 * Portado del `bank_portals` del mapi viejo (~275 portales). Se puebla por
 * migración inicial + alta manual (`POST /v1/bank/portals`).
 */
export const bankPortals = pgTable('bank_portals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  portalUrl: text('portal_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type BankPortal = typeof bankPortals.$inferSelect
export type NewBankPortal = typeof bankPortals.$inferInsert
