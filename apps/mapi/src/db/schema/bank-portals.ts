import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Catálogo abierto de portales bancarios. Cada row representa un banco /
 * institución financiera que algún cliente del despacho usa.
 *
 * Empieza vacío. Se pobla por:
 *  - Seed inicial desde CSV exportado del Excel del operador
 *    (`pnpm seed:bank-accounts`).
 *  - Endpoint admin `POST /v1/banking/portals` (alta manual desde la web).
 *
 * Decisión D-mapi-BW-003: catálogo abierto, NO enum hardcoded. El operador
 * tiene ~275 portales hoy y crecerá. Los adapters bancarios (v0.16.0+)
 * conocen internamente a qué `bank_portals.id` corresponden — el schema
 * no codifica esa relación.
 *
 * `name` es único: dos portales no pueden compartir nombre (ej. dos
 * filas "Chase" distintas).
 */
export const bankPortals = pgTable('bank_portals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  portalUrl: text('portal_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type BankPortal = typeof bankPortals.$inferSelect
export type NewBankPortal = typeof bankPortals.$inferInsert
