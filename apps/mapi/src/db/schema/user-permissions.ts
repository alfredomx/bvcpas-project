import { boolean, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { permissions } from './permissions'

/**
 * Overrides individuales de permisos por usuario. Caso de uso motivador:
 * Lorena e Ileana ambas tienen el rol "Bookkeeper" pero Lorena puede
 * borrar credenciales bancarias e Ileana no.
 *
 * Decisión D-mapi-PRM-001 — Nivel 3 RBAC: overrides por usuario sobre
 * los permisos heredados de sus roles.
 *
 * Cálculo del permiso efectivo del user:
 *   permisos_efectivos =
 *       (UNION de role_permissions de sus user_roles)
 *     UNION
 *       (user_permissions WHERE granted = true)
 *     EXCEPT
 *       (user_permissions WHERE granted = false)
 *
 * `granted = true`: el usuario tiene este permiso EXTRA aunque su rol
 * no lo otorgue. (Lorena puede borrar.)
 *
 * `granted = false`: el usuario NO tiene este permiso AUNQUE su rol sí
 * lo otorgue. (Ileana es Bookkeeper pero no puede update.)
 *
 * `reason`: texto libre para que el admin justifique el override en el
 * momento de aplicarlo. Útil para auditoría.
 *
 * Modificar esta tabla invalida SOLO el cache del usuario afectado
 * (vía `PermissionsService.invalidateUserCache`).
 */
export const userPermissions = pgTable(
  'user_permissions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    granted: boolean('granted').notNull(),
    reason: text('reason'),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.permissionId] }),
  }),
)

export type UserPermission = typeof userPermissions.$inferSelect
export type NewUserPermission = typeof userPermissions.$inferInsert
