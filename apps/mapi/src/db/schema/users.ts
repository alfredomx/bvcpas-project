import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Branded type para IDs de user. Evita pasar un string cualquiera donde
 * se espera un UserId (ej. confundir email con id).
 */
export type UserId = string & { readonly __brand: 'UserId' }

/**
 * Roles del sistema. v0.2.0 arranca con 2:
 * - admin: gestiona users, ve todo, ejecuta acciones de operación.
 * - viewer: solo lectura de dashboards.
 *
 * Cuando entre rol bookkeeper (M3 si crece equipo), se agrega aquí + migration.
 */
export const USER_ROLES = ['admin', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

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
 * a dashboards. Heredado de mapi v0.x con renames mínimos.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role', { enum: USER_ROLES }).notNull(),
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
    statusRoleIdx: index('users_status_role_idx').on(table.status, table.role),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
