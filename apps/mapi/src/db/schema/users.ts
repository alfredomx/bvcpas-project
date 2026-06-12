import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Branded type para IDs de user. Evita pasar un string cualquiera donde
 * se espera un UserId (ej. confundir email con id).
 */
export type UserId = string & { readonly __brand: 'UserId' }

/**
 * Status de la cuenta:
 * - active: puede loguear y operar.
 * - disabled: no puede loguear (despido permanente o bloqueo temporal).
 *   Combinado con revoke-all de sesiones, queda completamente fuera.
 */
export const USER_STATUSES = ['active', 'disabled'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

/**
 * Tabla de usuarios del sistema. Cada user tiene login propio para acceder
 * a dashboards.
 *
 * v0.15.0 (módulo 15-permissions): la columna `role` fue eliminada. Los
 * permisos del usuario ahora viven en RBAC dinámico vía `user_roles` y
 * `user_permissions`. Ver D-mapi-PRM-003.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    statusIdx: index('users_status_idx').on(table.status),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
