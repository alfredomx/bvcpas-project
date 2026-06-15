import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'

/**
 * Diccionario de alias → cliente. Resuelve el problema de identificar a un
 * cliente cuando el operador NO da el `qbo_realm_id` ni el `legal_name`
 * exacto, sino una referencia corta ("sre", "bilia").
 *
 * Flujo: si una referencia difusa es ambigua, el asistente pregunta una vez
 * ("¿te refieres a SRE Services?"), el operador confirma, y se guarda aquí.
 * La próxima vez que diga "sre" pega directo, sin volver a preguntar — en
 * cualquier sesión, porque vive en la DB, no en la memoria del modelo.
 *
 * `alias` es la PK (normalizado a minúsculas). Un alias apunta a un solo
 * cliente; re-confirmar el mismo alias lo re-apunta (upsert).
 */
export const clientAliases = pgTable('client_aliases', {
  alias: text('alias').primaryKey(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type ClientAlias = typeof clientAliases.$inferSelect
export type NewClientAlias = typeof clientAliases.$inferInsert
