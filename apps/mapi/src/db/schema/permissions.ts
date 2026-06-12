import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Catálogo de permisos atómicos del sistema. Cada permiso es un código
 * único con formato `<modulo>.<accion>` (decisión D-mapi-PRM-007 —
 * consolidado por módulo, sin granularidad por sub-recurso).
 *
 * Esta tabla se popula en la migration inicial desde el
 * `PermissionsRegistry` en código (`src/core/permissions/permissions.registry.ts`).
 * El registry es la fuente de verdad — los permisos solo se agregan
 * editando el registry y generando una migration que los inserte.
 *
 * Wildcards soportados (resueltos en `PermissionsGuard`, no en la tabla):
 * - `*`: todos los permisos del sistema (rol Administrator).
 * - `<modulo>.*`: todos los permisos del módulo.
 * - `*.read`: todos los `.read` de todos los módulos (rol Viewer).
 *
 * `module` agrupa permisos para la UI de gestión y para los filtros
 * del endpoint `GET /v1/permissions/permissions` que lista el catálogo
 * agrupado.
 */
export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  module: text('module').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type Permission = typeof permissions.$inferSelect
export type NewPermission = typeof permissions.$inferInsert
