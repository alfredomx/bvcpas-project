import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { userConnections } from './user-connections'

/**
 * Permisos compartidos por conexión. Cada fila = un user invitado a una
 * conexión que NO le pertenece.
 *
 * Reglas (v0.10.0):
 * - El DUEÑO de la conexión (`user_connections.user_id`) NO aparece aquí.
 *   Su acceso viene por dueño, no por share.
 * - Solo el dueño puede gestionar shares (POST/PATCH/DELETE).
 * - `permission`:
 *   - 'read'  → puede leer/listar/test pero no escribir.
 *   - 'write' → puede leer + acciones de escritura del provider.
 *
 * Cuando la conexión se borra, las filas se borran en cascada (FK).
 */
export const PERMISSION_VALUES = ['read', 'write'] as const
export type ConnectionPermission = (typeof PERMISSION_VALUES)[number]

export const connectionAccess = pgTable(
  'connection_access',
  {
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => userConnections.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.connectionId, t.userId] }),
  }),
)

export type ConnectionAccess = typeof connectionAccess.$inferSelect
export type NewConnectionAccess = typeof connectionAccess.$inferInsert
