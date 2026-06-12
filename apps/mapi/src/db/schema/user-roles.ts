import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { roles } from './roles'

/**
 * Tabla pivote usuario ↔ rol. Un usuario puede tener N roles; cuando
 * tiene varios, sus permisos efectivos son la unión de los permisos de
 * todos sus roles, modulados por overrides individuales en
 * `user_permissions`.
 *
 * Modificar esta tabla invalida el cache de permisos del usuario
 * afectado (vía `PermissionsService.invalidateUserCache`).
 *
 * Regla operativa (D-mapi-PRM error `UserMustHaveAtLeastOneRoleError`):
 * un usuario NO puede quedar sin roles. Si se intenta revocar el último
 * rol, falla con HTTP 422. El operador debe asignar otro rol antes.
 *
 * `granted_by` registra qué admin asignó el rol — para auditoría.
 * NULL solo en seed inicial al migrar `users.role`.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
  }),
)

export type UserRoleAssignment = typeof userRoles.$inferSelect
export type NewUserRoleAssignment = typeof userRoles.$inferInsert
