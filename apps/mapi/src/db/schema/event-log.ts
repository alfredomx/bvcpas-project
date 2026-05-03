import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Tabla de auditoría estructurada permanente. Cada acción auditable del
 * sistema deja una row aquí.
 *
 * Heredado de mapi v0.x (D-053, D-082). Schema simplificado con renames:
 * - `kind` → `event_type`
 * - `entity_*` → `resource_*`
 * - sin columna `severity` (todos los eventos son info, D-084)
 *
 * Convención de event_type: `<dominio>.<recurso>.<acción>`. Ejemplos:
 *   auth.login.success, auth.user.created, auth.session.revoked_by_admin.
 *
 * `actor_user_id` puede ser NULL (login fallido sin user identificado, o
 * eventos del sistema sin actor humano). NO tiene FK estricto a users
 * para preservar histórico (D-051 mapi v0.x).
 *
 * `payload` es jsonb libre — cada event_type define su shape esperado
 * pero el schema de DB no lo valida.
 */
export const eventLog = pgTable(
  'event_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: text('event_type').notNull(),
    actorUserId: uuid('actor_user_id'),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    eventTypeIdx: index('event_log_event_type_idx').on(table.eventType),
    actorUserIdIdx: index('event_log_actor_user_id_idx').on(table.actorUserId),
    createdAtIdx: index('event_log_created_at_idx').on(table.createdAt),
    resourceIdx: index('event_log_resource_idx').on(table.resourceType, table.resourceId),
  }),
)

export type EventLogRow = typeof eventLog.$inferSelect
export type NewEventLogRow = typeof eventLog.$inferInsert
