import { z } from 'zod'
import { BANK_CREDENTIAL_STATUSES } from '../bank-credentials.schema'
import { BANK_ACCOUNT_STATUSES, BANK_ACCOUNT_TYPES } from '../bank-accounts.schema'

// ───── Portales ─────────────────────────────────────────────────────────────

/** Body de `POST /v1/bank/portals`. */
export const createPortalSchema = z.object({
  name: z.string().min(1),
  portalUrl: z.string().min(1).nullish(),
})
export type CreatePortalDto = z.infer<typeof createPortalSchema>

// ───── Credenciales ───────────────────────────────────────────────────────────

/** Query de `GET /v1/bank/credentials` (todos los filtros opcionales). */
export const credentialListQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  portalId: z.string().uuid().optional(),
  status: z.enum(BANK_CREDENTIAL_STATUSES).optional(),
  search: z.string().min(1).optional(),
})
export type CredentialListQueryDto = z.infer<typeof credentialListQuerySchema>

/** Body de `POST /v1/bank/credentials`. */
export const createCredentialSchema = z.object({
  clientId: z.string().uuid(),
  bankPortalId: z.string().uuid(),
  nickname: z.string().nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  securityQa: z.string().nullish(),
  status: z.enum(BANK_CREDENTIAL_STATUSES).optional(),
  notes: z.string().nullish(),
})
export type CreateCredentialDto = z.infer<typeof createCredentialSchema>

/** Body de `PATCH /v1/bank/credentials/:id` (campo presente = se actualiza). */
export const updateCredentialSchema = z.object({
  nickname: z.string().nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  securityQa: z.string().nullish(),
  status: z.enum(BANK_CREDENTIAL_STATUSES).optional(),
  notes: z.string().nullish(),
})
export type UpdateCredentialDto = z.infer<typeof updateCredentialSchema>

// ───── Cuentas ────────────────────────────────────────────────────────────────

const accountMask = z.string().regex(/^\d{4}$/, 'el mask son 4 dígitos')

/** Query de `GET /v1/bank/accounts` (credentialId requerido). */
export const accountListQuerySchema = z.object({
  credentialId: z.string().uuid(),
})
export type AccountListQueryDto = z.infer<typeof accountListQuerySchema>

/** Body de `POST /v1/bank/accounts`. */
export const createAccountSchema = z.object({
  bankCredentialId: z.string().uuid(),
  accountMask,
  accountType: z.enum(BANK_ACCOUNT_TYPES),
  label: z.string().nullish(),
  status: z.enum(BANK_ACCOUNT_STATUSES).optional(),
  notes: z.string().nullish(),
})
export type CreateAccountDto = z.infer<typeof createAccountSchema>

/** Body de `PATCH /v1/bank/accounts/:id`. */
export const updateAccountSchema = z.object({
  accountType: z.enum(BANK_ACCOUNT_TYPES).optional(),
  label: z.string().nullish(),
  status: z.enum(BANK_ACCOUNT_STATUSES).optional(),
  notes: z.string().nullish(),
})
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>
