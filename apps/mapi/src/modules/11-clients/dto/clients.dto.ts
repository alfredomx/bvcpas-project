import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import {
  CLIENT_STATUSES,
  CLIENT_TIERS,
  CLIENT_TRANSACTIONS_FILTERS,
} from '../../../db/schema/clients'

export const ListClientsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1).describe('Página (>=1)'),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(200)
      .default(50)
      .describe('Tamaño de página (max 200)'),
    status: z.enum(CLIENT_STATUSES).optional().describe('Filtra por status'),
    tier: z.enum(CLIENT_TIERS).optional().describe('Filtra por tier (silver/gold/platinum)'),
    search: z
      .string()
      .min(1)
      .optional()
      .describe('Búsqueda parcial en legal_name (case-insensitive)'),
  })
  .describe('Query params para listar clientes')

export class ListClientsQueryDto extends createZodDto(ListClientsQuerySchema) {}

const ClientSchema = z.object({
  id: z.string().uuid(),
  legal_name: z.string(),
  dba: z.string().nullable(),
  qbo_realm_id: z.string().nullable(),
  industry: z.string().nullable(),
  entity_type: z.string().nullable(),
  fiscal_year_start: z.number().int().nullable(),
  timezone: z.string().nullable(),
  status: z.enum(CLIENT_STATUSES),
  tier: z.enum(CLIENT_TIERS),
  draft_email_enabled: z.boolean(),
  transactions_filter: z.enum(CLIENT_TRANSACTIONS_FILTERS),
  cc_email: z.string().nullable(),
  primary_contact_name: z.string().nullable(),
  primary_contact_email: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export class ClientDto extends createZodDto(ClientSchema) {}

const ClientsListResponseSchema = z
  .object({
    items: z.array(ClientSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
  .describe('Respuesta paginada de clientes')

export class ClientsListResponseDto extends createZodDto(ClientsListResponseSchema) {}

/**
 * Acepta uno o más correos separados por coma. Cada correo se valida
 * con un regex simple (algo@algo.algo, sin espacios). El input se
 * normaliza antes de validar:
 *   - trim general + trim por correo
 *   - elimina elementos vacíos intermedios ("a@x.com,  ,, b@y.com" → "a@x.com, b@y.com")
 *   - reformatea con ", " como separador estándar
 *   - string vacío o solo whitespace → null ("sin contacto")
 *
 * Válidos:   "a@x.com", "a@x.com,b@y.com", "a@x.com, b@y.com", "" → null
 * Inválidos: "basura", "a@x.com, basura", "a@x"
 */
const SIMPLE_EMAIL_REGEX = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/
const csvEmailString = z
  .string()
  .transform((s) => {
    const trimmed = s.trim()
    if (trimmed === '') return null
    return trimmed
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .join(', ')
  })
  .refine(
    (s) => {
      if (s === null) return true
      const parts = s
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0)
      return parts.length > 0 && parts.every((e) => SIMPLE_EMAIL_REGEX.test(e))
    },
    { message: 'Debe ser uno o más correos válidos separados por coma' },
  )

export const UpdateClientSchema = z
  .object({
    legalName: z.string().min(1).max(200).optional(),
    dba: z.string().max(200).nullable().optional(),
    industry: z.string().max(80).nullable().optional(),
    entityType: z.string().max(40).nullable().optional(),
    fiscalYearStart: z.number().int().min(1).max(12).nullable().optional(),
    timezone: z.string().max(60).nullable().optional(),
    tier: z.enum(CLIENT_TIERS).optional(),
    draftEmailEnabled: z.boolean().optional(),
    transactionsFilter: z.enum(CLIENT_TRANSACTIONS_FILTERS).optional(),
    ccEmail: csvEmailString.nullable().optional(),
    primaryContactName: z.string().max(120).nullable().optional(),
    primaryContactEmail: csvEmailString.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .describe(
    'Campos editables de un cliente. Solo se aplican los presentes en el body. Pasar campos NO editables (status, qbo_realm_id, etc.) devuelve 400.',
  )

export class UpdateClientDto extends createZodDto(UpdateClientSchema) {}

export const ChangeStatusSchema = z
  .object({
    status: z.enum(CLIENT_STATUSES).describe('Nuevo status del cliente'),
  })
  .describe('Cambio de status (active/paused/offboarded)')

export class ChangeStatusDto extends createZodDto(ChangeStatusSchema) {}
