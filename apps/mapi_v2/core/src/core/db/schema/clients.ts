import {
  pgTable,
  uuid,
  text,
  varchar,
  smallint,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Branded type para IDs de cliente. Evita confundir un client_id con un UUID
 * arbitrario en las firmas de servicios/repos.
 */
export type ClientId = string & { readonly __brand: 'ClientId' }

/**
 * Estados válidos de un cliente.
 *
 * - `active`: vigente, operación normal.
 * - `paused`: temporalmente sin operación (vacaciones, dispute, etc.).
 * - `offboarded`: dado de baja (soft delete — no hay DELETE físico).
 */
export const CLIENT_STATUSES = ['active', 'paused', 'offboarded'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

/**
 * Tabla central de clientes (entidad fundacional del core, modelo WordPress).
 *
 * Genérica y agnóstica de proveedor: NO lleva nada de QBO (realm_id/tokens viven
 * en `plugins/intuit`, tabla `intuit_tokens` llaveada por `client_id`) ni flags
 * de uncats. Los plugins la leen vía `ClientsService` y la extienden con su
 * propia tabla. (D-core-021, D-core-022)
 */
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legalName: varchar('legal_name', { length: 200 }).notNull(),
    dba: varchar('dba', { length: 200 }),
    industry: varchar('industry', { length: 80 }),
    entityType: varchar('entity_type', { length: 40 }),
    fiscalYearStart: smallint('fiscal_year_start'), // 1-12 (mes)
    timezone: varchar('timezone', { length: 60 }), // p.ej. America/Mexico_City
    status: varchar('status', { length: 20, enum: CLIENT_STATUSES }).notNull().default('active'),
    primaryContactName: varchar('primary_contact_name', { length: 120 }),
    primaryContactEmail: varchar('primary_contact_email', { length: 255 }),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index('clients_status_legal_name_idx').on(table.status, table.legalName)],
)

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
