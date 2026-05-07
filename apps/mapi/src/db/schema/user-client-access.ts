import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { clients } from './clients'

/**
 * Permisos granulares por (usuario × cliente). Si existe la fila, el
 * usuario tiene acceso al cliente. Si no, no lo ve (404).
 *
 * En v0.8.0 esta tabla se llena solo por SQL directo. Cuando exista UI
 * admin, se agrega endpoint POST/DELETE para gestionar accesos.
 *
 * `ClientAccessGuard` (en `core/auth/guards/`) consulta esta tabla en
 * todo controller con `:id` del cliente en path.
 *
 * Migración inicial: el initial admin (`alfredo@pixvector.mx`) recibe
 * acceso a TODOS los clientes existentes.
 */
export const userClientAccess = pgTable(
  'user_client_access',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.clientId] }),
  }),
)

export type UserClientAccess = typeof userClientAccess.$inferSelect
export type NewUserClientAccess = typeof userClientAccess.$inferInsert
