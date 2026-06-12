import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { roles } from './roles'
import { permissions } from './permissions'
import { users } from './users'

/**
 * Tabla pivote rol ↔ permiso. Una fila representa "el rol X tiene el
 * permiso Y".
 *
 * Modificar esta tabla invalida el cache de permisos de TODOS los users
 * que tienen el rol (vía `PermissionsService.invalidateUsersWithRole`).
 *
 * `granted_by` registra qué admin asignó este permiso al rol — para
 * auditoría. NULL solo en seed inicial (sin actor humano).
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
)

export type RolePermission = typeof rolePermissions.$inferSelect
export type NewRolePermission = typeof rolePermissions.$inferInsert
