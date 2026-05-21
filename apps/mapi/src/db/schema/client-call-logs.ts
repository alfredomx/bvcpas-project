import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'
import { users } from './users'

/**
 * Bitácora de llamadas/contactos del equipo a un cliente. Registro simple,
 * no es sistema de followups: sin recordatorios, sin notificaciones, sin cron.
 *
 * Outcomes:
 * - `responded`: cliente atendió y dio respuesta concreta.
 * - `no_answer`: no contestaron.
 * - `voicemail`: salió buzón / se dejó mensaje.
 * - `refused`: contestaron pero se negaron a colaborar.
 * - `other`: cualquier otro caso, ver `notes`.
 *
 * Delete = hard delete (D-mapi-053): si el operador borra, se va de la DB.
 */
export const CALL_LOG_OUTCOMES = [
  'responded',
  'no_answer',
  'voicemail',
  'refused',
  'other',
] as const
export type CallLogOutcome = (typeof CALL_LOG_OUTCOMES)[number]

export const clientCallLogs = pgTable(
  'client_call_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    calledAt: timestamp('called_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    outcome: text('outcome', { enum: CALL_LOG_OUTCOMES }).notNull(),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    byClient: index('client_call_logs_client_idx').on(table.clientId, table.calledAt.desc()),
  }),
)

export type ClientCallLog = typeof clientCallLogs.$inferSelect
export type NewClientCallLog = typeof clientCallLogs.$inferInsert
