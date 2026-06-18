import { z } from 'zod'
import { DATE_RANGE_PRESETS } from '../date-range.util'

/** DTOs del step-flow de descarga bancaria. Rutas flat; `clientId` se deriva del credential. */

const mask = z.string().regex(/^\d{4}$/, 'accountMask deben ser 4 dígitos')
const mmddyyyy = z.string().regex(/^\d{2}-\d{2}-\d{4}$/, 'fecha debe ser MM-DD-YYYY')

/** `range` (preset) XOR `from`+`to` (juntos). Defensa común de los verbos por rango. */
function refineRange(
  data: { range?: string; from?: string; to?: string },
  ctx: z.RefinementCtx,
): void {
  const hasPreset = data.range !== undefined
  const hasFrom = data.from !== undefined
  const hasTo = data.to !== undefined
  if (hasPreset && (hasFrom || hasTo)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Usa `range` O `from`+`to`, no ambos.' })
  }
  if (!hasPreset && !(hasFrom && hasTo)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Envía `range` (preset) o `from`+`to`.' })
  }
}

// ───── login + cuentas en vivo ─────────────────────────────────────────────

export const listAccountsRequestSchema = z.object({ credentialId: z.string().uuid() }).strict()
export type ListAccountsRequestDto = z.infer<typeof listAccountsRequestSchema>

export interface LiveAccount {
  mask: string
  type: string
  name: string | null
}
export interface ListAccountsResponse {
  credential_id: string
  portal: string
  /** "Hoy" en la zona del cliente (MM-DD-YYYY): ancla para rangos libres. */
  today: string
  timezone: string
  accounts: LiveAccount[]
}

// ───── verbos de descarga ──────────────────────────────────────────────────

export const downloadChecksSchema = z
  .object({
    credentialId: z.string().uuid(),
    accountMasks: z.array(mask).min(1),
    range: z.enum(DATE_RANGE_PRESETS).optional(),
    from: mmddyyyy.optional(),
    to: mmddyyyy.optional(),
    save: z.boolean().optional(),
  })
  .strict()
  .superRefine(refineRange)
export type DownloadChecksDto = z.infer<typeof downloadChecksSchema>

export const downloadDepositsSchema = downloadChecksSchema
export type DownloadDepositsDto = z.infer<typeof downloadDepositsSchema>

export const downloadStatementsSchema = z
  .object({
    credentialId: z.string().uuid(),
    accountMasks: z.array(mask).min(1),
    latest: z.boolean().optional(),
    from: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'from debe ser YYYY-MM')
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'to debe ser YYYY-MM')
      .optional(),
    save: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.latest && data.from) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Usa `latest` O `from`, no ambos.' })
    }
    if (!data.latest && !data.from) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Falta `latest` o `from`.' })
    }
    if (data.to && data.from && data.to < data.from) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '`to` no puede ser anterior a `from`.' })
    }
  })
export type DownloadStatementsDto = z.infer<typeof downloadStatementsSchema>

export const downloadTransactionsSchema = z
  .object({
    credentialId: z.string().uuid(),
    accountMasks: z.array(mask).min(1),
    format: z.enum(['CSV', 'QBO']),
    range: z.enum(DATE_RANGE_PRESETS).optional(),
    from: mmddyyyy.optional(),
    to: mmddyyyy.optional(),
    save: z.boolean().optional(),
  })
  .strict()
  .superRefine(refineRange)
export type DownloadTransactionsDto = z.infer<typeof downloadTransactionsSchema>

// ───── read verbs (preview, sin imágenes) ──────────────────────────────────

export const listActivitySchema = z
  .object({
    credentialId: z.string().uuid(),
    accountMasks: z.array(mask).min(1),
    range: z.enum(DATE_RANGE_PRESETS).optional(),
    from: mmddyyyy.optional(),
    to: mmddyyyy.optional(),
  })
  .strict()
  .superRefine(refineRange)
export type ListActivityDto = z.infer<typeof listActivitySchema>

export const listStatementRefsSchema = z
  .object({
    credentialId: z.string().uuid(),
    accountMasks: z.array(mask).min(1),
    yearsBack: z.coerce.number().int().min(0).max(10).optional(),
  })
  .strict()
export type ListStatementRefsDto = z.infer<typeof listStatementRefsSchema>

// ───── shapes de respuesta (ensamblados por el service) ────────────────────

import type { DepositResult, DownloadedImage, StatementResult } from '../bank-download.types'
import type { BankTxn, StatementRef } from '../adapters/bank-adapter.base'

export interface DownloadChecksResponse {
  credential_id: string
  portal: string
  range: { from: string; to: string }
  accounts: { account_mask: string; count: number; checks: DownloadedImage[] }[]
  total_checks: number
  saved_dir: string | null
}

export interface DownloadDepositsResponse {
  credential_id: string
  portal: string
  range: { from: string; to: string }
  accounts: {
    account_mask: string
    deposit_count: number
    image_count: number
    deposits: DepositResult[]
  }[]
  total_images: number
  saved_dir: string | null
}

export interface DownloadStatementsResponse {
  credential_id: string
  portal: string
  accounts: { account_mask: string; count: number; statements: StatementResult[] }[]
  total_statements: number
  saved_dir: string | null
}

export interface DownloadTransactionsResponse {
  credential_id: string
  portal: string
  range: { from: string; to: string }
  format: 'CSV' | 'QBO'
  accounts: { account_mask: string; bytes: number; content?: string }[]
  saved_dir: string | null
}

export interface ListActivityResponse {
  credential_id: string
  portal: string
  range: { from: string; to: string }
  accounts: { account_mask: string; count: number; items: BankTxn[] }[]
  total: number
}

export interface ListStatementRefsResponse {
  credential_id: string
  portal: string
  accounts: { account_mask: string; count: number; items: StatementRef[] }[]
  total: number
}
