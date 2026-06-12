import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Roles del sistema RBAC. Cada rol agrupa N permisos y se asigna a M
 * usuarios. Los permisos efectivos del usuario son la unión de los
 * permisos de todos sus roles, modulada por los overrides individuales
 * (ver `userPermissions`).
 *
 * Decisión D-mapi-PRM-001: RBAC con overrides por usuario (Nivel 3).
 * Decisión D-mapi-PRM-002: módulo separado `15-permissions` (no en
 * `10-core-auth`).
 *
 * `is_system = true`: rol creado por la migration inicial. NO se puede
 * editar (cambiar name/description) ni eliminar. Solo asignar/revocar
 * a usuarios.
 *
 * En v0.15.0 hay 2 roles del sistema:
 * - **Administrator** (`*`): super-rol con todos los permisos.
 * - **Viewer** (`*.read`): solo lectura en todos los módulos.
 *
 * Los demás roles los crea el operador (admin) vía endpoint
 * `POST /v1/permissions/roles`.
 */
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
