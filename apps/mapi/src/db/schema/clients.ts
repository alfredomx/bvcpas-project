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
 * Branded type para IDs de cliente. Evita confundir un client_id con un
 * UUID arbitrario.
 */
export type ClientId = string & { readonly __brand: 'ClientId' }

/**
 * Estados válidos de un cliente.
 *
 * - `active`: cliente vigente, recibe operación normal.
 * - `paused`: temporalmente sin operación (vacaciones, dispute, etc.).
 * - `offboarded`: dado de baja (soft delete, heredado D-mapi-v0.x-039).
 */
export const CLIENT_STATUSES = ['active', 'paused', 'offboarded'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

/**
 * Tabla de clientes bookkeeper. Cada row representa una empresa que el
 * operador atiende. Heredado de mapi v0.x con shape idéntico.
 *
 * `qbo_realm_id` es nullable: un cliente puede crearse antes de autorizar
 * QBO, o quedarse sin QBO (caso de cliente sin QuickBooks Online).
 */
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legalName: varchar('legal_name', { length: 200 }).notNull(),
    dba: varchar('dba', { length: 200 }),
    qboRealmId: text('qbo_realm_id').unique(),
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
  (table) => ({
    statusLegalNameIdx: index('clients_status_legal_name_idx').on(table.status, table.legalName),
  }),
)

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
