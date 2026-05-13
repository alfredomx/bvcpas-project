import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients } from './clients'
import { users } from './users'

/**
 * Status del cliente en un periodo mensual concreto. Una fila única por
 * `(client_id, period)`.
 *
 * Estados:
 * - `pending`: nada hecho todavía.
 * - `ready_to_send`: snapshot listo, falta enviar email al cliente.
 * - `sent`: email enviado, esperando respuesta.
 * - `awaiting_reply`: sinónimo operativo de `sent` (lo distinguimos para badges UI).
 * - `partial_reply`: cliente respondió algunas pero no todas.
 * - `complete`: todas las uncats del periodo respondidas + sincronizadas a QBO.
 * - `review_needed`: cliente respondió todo pero falta que el operador revise.
 *
 * Esta tabla NO calcula el status automáticamente todavía (v0.6.3 trae cron).
 * En v0.6.0 se cambia on-demand desde el dashboard o cuando el cliente responde.
 */
export const FOLLOWUP_STATUSES = [
  'pending',
  'ready_to_send',
  'sent',
  'awaiting_reply',
  'partial_reply',
  'complete',
  'review_needed',
] as const
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number]

export const clientPeriodFollowups = pgTable(
  'client_period_followups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    period: varchar('period', { length: 7 }).notNull(), // formato 'YYYY-MM'

    status: text('status', { enum: FOLLOWUP_STATUSES }).notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    lastReplyAt: timestamp('last_reply_at', { withTimezone: true }),
    /**
     * Última vez que el cliente estuvo al 100% de uncats respondidas en este
     * período específico. Se setea a NOW() cuando responded_activas >= uncats
     * en el período. NO se borra si después baja del 100% — queda como marca
     * histórica del último día limpio.
     *
     * Usado por `computeSilentStreakDays` (v0.13.0+) para calcular el atraso
     * operativo del libro contable de manera justa.
     */
    lastFullyRespondedAt: timestamp('last_fully_responded_at', { withTimezone: true }),
    sentByUserId: uuid('sent_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    internalNotes: text('internal_notes'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    uniqueByClientPeriod: uniqueIndex('client_period_followups_unique_idx').on(
      table.clientId,
      table.period,
    ),
  }),
)

export type ClientPeriodFollowup = typeof clientPeriodFollowups.$inferSelect
export type NewClientPeriodFollowup = typeof clientPeriodFollowups.$inferInsert
