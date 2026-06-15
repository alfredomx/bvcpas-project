import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { CLIENT_BANK_ACCOUNT_STATUSES } from '../../../db/schema/client-bank-accounts'
import { BANK_ACCOUNT_STATUSES, BANK_ACCOUNT_TYPES } from '../../../db/schema/bank-accounts'
import { DATE_RANGE_PRESETS } from '../date-range.util'

/**
 * DTOs del step-flow de descarga bancaria (v0.21.0):
 *  - `list_credentials`: vista picker de credenciales del vault, SIN secretos.
 *  - `list_accounts`: cuentas EN VIVO del banco (tras login) + ancla `today`.
 *  - `download_checks`: descarga de cheques de N cuentas por rango (preset o explícito).
 */

const mask = z
  .string()
  .regex(/^\d{4}$/, 'accountMask deben ser 4 dígitos')
  .describe('Últimos 4 dígitos de la cuenta.')

const mmddyyyy = z
  .string()
  .regex(/^\d{2}-\d{2}-\d{4}$/, 'fecha debe ser MM-DD-YYYY')
  .describe('Fecha en formato MM-DD-YYYY.')

// ───── list_credentials ──────────────────────────────────────────────────

export const ListCredentialsQuerySchema = z
  .object({
    portal: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Filtro difuso por nombre de portal (ej. "rbfcu", "chase").'),
  })
  .strict()
export class ListCredentialsQueryDto extends createZodDto(ListCredentialsQuerySchema) {}

const PickerAccountSchema = z.object({
  id: z.string().uuid(),
  mask: z.string(),
  type: z.enum(BANK_ACCOUNT_TYPES),
  label: z.string().nullable(),
  status: z.enum(BANK_ACCOUNT_STATUSES),
})

export const CredentialPickerItemSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.object({
    id: z.string().uuid(),
    name: z.string(),
    portal_url: z.string().nullable(),
  }),
  nickname: z.string().nullable(),
  status: z.enum(CLIENT_BANK_ACCOUNT_STATUSES),
  /** Adapter de descarga implementado para el portal (Chase = true hoy). */
  download_supported: z.boolean(),
  accounts: z.array(PickerAccountSchema),
})

export type CredentialPickerItem = z.infer<typeof CredentialPickerItemSchema>

export const ListCredentialsResponseSchema = z.object({
  data: z.array(CredentialPickerItemSchema),
})
export type ListCredentialsResponse = z.infer<typeof ListCredentialsResponseSchema>
export class ListCredentialsResponseDto extends createZodDto(ListCredentialsResponseSchema) {}

// ───── list_accounts (cuentas en vivo, tras login) ────────────────────────

export const ListAccountsRequestSchema = z
  .object({
    credentialId: z
      .string()
      .uuid()
      .describe('Credencial (client_bank_accounts.id). Define el portal y las creds de login.'),
  })
  .strict()
export class ListAccountsRequestDto extends createZodDto(ListAccountsRequestSchema) {}

const LiveAccountSchema = z.object({
  mask: z.string().describe('Últimos 4 dígitos.'),
  type: z.string().describe('Tipo genérico (checking, credit, ...).'),
  name: z.string().nullable().describe('Nombre/nickname de la cuenta en el banco.'),
})

export const ListAccountsResponseSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.string(),
  /** "Hoy" en la zona del cliente (MM-DD-YYYY). Ancla para rangos libres. */
  today: z.string(),
  timezone: z.string(),
  accounts: z.array(LiveAccountSchema),
})
export type ListAccountsResponse = z.infer<typeof ListAccountsResponseSchema>
export class ListAccountsResponseDto extends createZodDto(ListAccountsResponseSchema) {}

// ───── download_checks ───────────────────────────────────────────────────

export const DownloadChecksSchema = z
  .object({
    credentialId: z
      .string()
      .uuid()
      .describe('Credencial a usar (client_bank_accounts.id). Define el portal/adapter.'),
    accountMasks: z
      .array(mask)
      .min(1)
      .describe('Cuentas a descargar (las elegidas de list_accounts). "Todas" = manda todas.'),
    range: z
      .enum(DATE_RANGE_PRESETS)
      .optional()
      .describe('Preset de rango (today, yesterday, last_7_days, ...). Alternativa a from+to.'),
    from: mmddyyyy.optional().describe('Fecha inicial (requiere `to`). Alternativa a `range`.'),
    to: mmddyyyy.optional().describe('Fecha final (requiere `from`).'),
    save: z
      .boolean()
      .optional()
      .describe(
        'Demo: guarda los cheques en apps/mapi/.downloads/<cliente>/<mask>/ y omite el base64 ' +
          'de la respuesta. El destino real (Dropbox) está diferido.',
      ),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasPreset = data.range !== undefined
    const hasFrom = data.from !== undefined
    const hasTo = data.to !== undefined
    const hasExplicit = hasFrom || hasTo

    if (hasPreset && hasExplicit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Usa `range` O `from`+`to`, no ambos.',
      })
    }
    if (!hasPreset && !hasExplicit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes enviar `range` (preset) o `from`+`to`.',
      })
    }
    if (hasExplicit && (!hasFrom || !hasTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`from` y `to` van juntos.',
      })
    }
  })
export class DownloadChecksDto extends createZodDto(DownloadChecksSchema) {}

const DownloadedCheckSchema = z.object({
  sequenceNumber: z.string(),
  type: z.string(),
  checkNumber: z.string().optional().describe('Número de cheque (para el nombre de archivo).'),
  postDate: z.string().optional().describe('Fecha de posteo (YYYYMMDD).'),
  amount: z.number().optional(),
  frontImageBase64: z.string().optional(),
  rearImageBase64: z.string().optional(),
})

export const DownloadChecksResponseSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.string(),
  range: z.object({ from: z.string(), to: z.string() }),
  accounts: z.array(
    z.object({
      account_mask: z.string(),
      count: z.number(),
      checks: z.array(DownloadedCheckSchema),
    }),
  ),
  total_checks: z.number(),
  /** Carpeta donde se guardaron los cheques si `save=true` (demo); null si no. */
  saved_dir: z.string().nullable(),
})
export type DownloadChecksResponse = z.infer<typeof DownloadChecksResponseSchema>
export class DownloadChecksResponseDto extends createZodDto(DownloadChecksResponseSchema) {}

// ───── download_deposits (slip + cheques del depósito, nombre CON monto) ────

export const DownloadDepositsSchema = z
  .object({
    credentialId: z.string().uuid().describe('Credencial a usar (define el portal/adapter).'),
    accountMasks: z.array(mask).min(1).describe('Cuentas a descargar (de list_accounts).'),
    range: z
      .enum(DATE_RANGE_PRESETS)
      .optional()
      .describe('Preset de rango. Alternativa a from+to.'),
    from: mmddyyyy.optional(),
    to: mmddyyyy.optional(),
    save: z
      .boolean()
      .optional()
      .describe('Guarda los PDFs (con monto en el nombre) en .downloads/.'),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasPreset = data.range !== undefined
    const hasFrom = data.from !== undefined
    const hasTo = data.to !== undefined
    if (hasPreset && (hasFrom || hasTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Usa `range` O `from`+`to`, no ambos.' })
    }
    if (!hasPreset && !(hasFrom && hasTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Envía `range` o `from`+`to`.' })
    }
  })
export class DownloadDepositsDto extends createZodDto(DownloadDepositsSchema) {}

const DepositResultSchema = z.object({
  depositSequenceNumber: z.string(),
  totalAmount: z.number(),
  depositSlipImage: DownloadedCheckSchema.optional(),
  checksImages: z.array(DownloadedCheckSchema),
})

export const DownloadDepositsResponseSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.string(),
  range: z.object({ from: z.string(), to: z.string() }),
  accounts: z.array(
    z.object({
      account_mask: z.string(),
      deposit_count: z.number(),
      image_count: z.number(),
      deposits: z.array(DepositResultSchema),
    }),
  ),
  total_images: z.number(),
  saved_dir: z.string().nullable(),
})
export type DownloadDepositsResponse = z.infer<typeof DownloadDepositsResponseSchema>
export class DownloadDepositsResponseDto extends createZodDto(DownloadDepositsResponseSchema) {}

// ───── download_statements (YYYY-MM.pdf) ──────────────────────────────────

export const DownloadStatementsSchema = z
  .object({
    credentialId: z.string().uuid(),
    accountMasks: z.array(mask).min(1),
    latest: z
      .boolean()
      .optional()
      .describe('Baja SOLO el estado de cuenta más reciente. Alternativa a year/month.'),
    year: z
      .string()
      .regex(/^\d{4}$/, 'year debe ser YYYY')
      .optional()
      .describe('Año de inicio (YYYY). Requerido si no se usa `latest`.'),
    month: z
      .string()
      .regex(/^([1-9]|1[0-2])$/, 'month 1-12')
      .optional()
      .describe('Mes de inicio (1-12). Opcional (con `year`).'),
    save: z.boolean().optional().describe('Guarda los PDFs (YYYY-MM.pdf) en .downloads/.'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.latest && data.year) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Usa `latest` O `year`, no ambos.' })
    }
    if (!data.latest && !data.year) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Falta `latest` o `year`.' })
    }
  })
export class DownloadStatementsDto extends createZodDto(DownloadStatementsSchema) {}

const StatementResultSchema = z.object({
  documentId: z.string(),
  date: z.string(),
  pdfBase64: z.string().optional(),
})

export const DownloadStatementsResponseSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.string(),
  accounts: z.array(
    z.object({
      account_mask: z.string(),
      count: z.number(),
      statements: z.array(StatementResultSchema),
    }),
  ),
  total_statements: z.number(),
  saved_dir: z.string().nullable(),
})
export type DownloadStatementsResponse = z.infer<typeof DownloadStatementsResponseSchema>
export class DownloadStatementsResponseDto extends createZodDto(DownloadStatementsResponseSchema) {}

// ───── download_transactions (CSV/QBO: <mask> (from to to).ext) ───────────

export const DownloadTransactionsSchema = z
  .object({
    credentialId: z.string().uuid(),
    accountMasks: z.array(mask).min(1),
    format: z.enum(['CSV', 'QBO']).describe('Formato del export.'),
    range: z.enum(DATE_RANGE_PRESETS).optional(),
    from: mmddyyyy.optional(),
    to: mmddyyyy.optional(),
    save: z.boolean().optional().describe('Guarda el archivo en .downloads/.'),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasPreset = data.range !== undefined
    const hasFrom = data.from !== undefined
    const hasTo = data.to !== undefined
    if (hasPreset && (hasFrom || hasTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Usa `range` O `from`+`to`, no ambos.' })
    }
    if (!hasPreset && !(hasFrom && hasTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Envía `range` o `from`+`to`.' })
    }
  })
export class DownloadTransactionsDto extends createZodDto(DownloadTransactionsSchema) {}

export const DownloadTransactionsResponseSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.string(),
  range: z.object({ from: z.string(), to: z.string() }),
  format: z.enum(['CSV', 'QBO']),
  accounts: z.array(
    z.object({
      account_mask: z.string(),
      bytes: z.number(),
      content: z.string().optional(),
    }),
  ),
  saved_dir: z.string().nullable(),
})
export type DownloadTransactionsResponse = z.infer<typeof DownloadTransactionsResponseSchema>
export class DownloadTransactionsResponseDto extends createZodDto(
  DownloadTransactionsResponseSchema,
) {}

// ───── read verbs (preview, SIN descargar imágenes) — v0.23.0 ─────────────
// Cuentan/listan la actividad o los statements disponibles. Baratos (sin
// imágenes/PDF). El conector los usa para "¿cuántos cheques hay?" antes de bajar.

export const ListActivitySchema = z
  .object({
    credentialId: z.string().uuid().describe('Credencial a usar (define portal/adapter).'),
    accountMasks: z.array(mask).min(1).describe('Cuentas a listar.'),
    range: z.enum(DATE_RANGE_PRESETS).optional(),
    from: mmddyyyy.optional(),
    to: mmddyyyy.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasPreset = data.range !== undefined
    const hasFrom = data.from !== undefined
    const hasTo = data.to !== undefined
    if (hasPreset && (hasFrom || hasTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Usa `range` O `from`+`to`, no ambos.' })
    }
    if (!hasPreset && !(hasFrom && hasTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Envía `range` o `from`+`to`.' })
    }
  })
export class ListActivityDto extends createZodDto(ListActivitySchema) {}

const ActivityItemSchema = z.object({
  sequenceNumber: z.string(),
  date: z.string().describe('Fecha de posteo (YYYYMMDD).'),
  amount: z.number().optional(),
  checkNumber: z.string().optional(),
})

export const ListActivityResponseSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.string(),
  range: z.object({ from: z.string(), to: z.string() }),
  accounts: z.array(
    z.object({
      account_mask: z.string(),
      count: z.number(),
      items: z.array(ActivityItemSchema),
    }),
  ),
  total: z.number(),
})
export type ListActivityResponse = z.infer<typeof ListActivityResponseSchema>
export class ListActivityResponseDto extends createZodDto(ListActivityResponseSchema) {}

export const ListStatementRefsSchema = z
  .object({
    credentialId: z.string().uuid().describe('Credencial a usar (define portal/adapter).'),
    accountMasks: z.array(mask).min(1).describe('Cuentas a listar.'),
    yearsBack: z.coerce
      .number()
      .int()
      .min(0)
      .max(10)
      .optional()
      .describe('Años hacia atrás a listar (default 1 = año actual + anterior).'),
  })
  .strict()
export class ListStatementRefsDto extends createZodDto(ListStatementRefsSchema) {}

export const ListStatementRefsResponseSchema = z.object({
  credential_id: z.string().uuid(),
  portal: z.string(),
  accounts: z.array(
    z.object({
      account_mask: z.string(),
      count: z.number(),
      items: z.array(z.object({ documentId: z.string(), date: z.string() })),
    }),
  ),
  total: z.number(),
})
export type ListStatementRefsResponse = z.infer<typeof ListStatementRefsResponseSchema>
export class ListStatementRefsResponseDto extends createZodDto(ListStatementRefsResponseSchema) {}

// ───── orquestación: 1 verbo de descarga (v0.27.0) ────────────────────────

/** Tipos que el verbo único de descarga sabe orquestar. */
export const ORCHESTRATE_WHATS = ['checks', 'deposits', 'statements', 'transactions'] as const

/**
 * Verbo único: resuelve cliente por nombre → credencial descargable → login →
 * descarga → logout, en una sola llamada. `params` lleva lo específico del tipo
 * (range/from/to/year/month/format/save) y se valida contra el schema de `what`.
 */
export const OrchestrateDownloadSchema = z
  .object({
    client: z.string().min(1).describe('Nombre (legal_name / alias / dba) o UUID del cliente.'),
    what: z.enum(ORCHESTRATE_WHATS).describe('Qué descargar.'),
    credentialId: z
      .string()
      .uuid()
      .optional()
      .describe('Forzar credencial (si el cliente tiene varias descargables).'),
    accounts: z
      .union([z.literal('all'), z.array(mask).min(1)])
      .optional()
      .describe('Cuentas a descargar. "all" (default) = todas las del login.'),
    params: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Parámetros del tipo (range/from/to/year/month/format/save). Validados según `what`.',
      ),
  })
  .strict()
export class OrchestrateDownloadDto extends createZodDto(OrchestrateDownloadSchema) {}

export const OrchestrateDownloadResponseSchema = z.object({
  client: z.object({ id: z.string().uuid(), legal_name: z.string() }),
  credential_id: z.string().uuid(),
  portal: z.string(),
  what: z.enum(ORCHESTRATE_WHATS),
  accounts_used: z.array(z.string()),
  /** El resultado del download_* correspondiente (shape según `what`). */
  result: z.unknown(),
})
export type OrchestrateDownloadResponse = z.infer<typeof OrchestrateDownloadResponseSchema>
export class OrchestrateDownloadResponseDto extends createZodDto(
  OrchestrateDownloadResponseSchema,
) {}
