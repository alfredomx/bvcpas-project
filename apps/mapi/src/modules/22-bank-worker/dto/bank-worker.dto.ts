import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { CLIENT_BANK_ACCOUNT_STATUSES } from '../../../db/schema/client-bank-accounts'
import { BANK_ACCOUNT_TYPES, BANK_ACCOUNT_STATUSES } from '../../../db/schema/bank-accounts'

// ───── Bank Portals ──────────────────────────────────────────────────────

export const CreateBankPortalSchema = z
  .object({
    name: z.string().min(1).max(200).describe('Nombre único del portal bancario.'),
    portalUrl: z
      .string()
      .url()
      .nullable()
      .optional()
      .describe('URL del portal de login del banco. Puede ser null si se desconoce.'),
  })
  .strict()

export class CreateBankPortalDto extends createZodDto(CreateBankPortalSchema) {}

export const UpdateBankPortalSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    portalUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  })

export class UpdateBankPortalDto extends createZodDto(UpdateBankPortalSchema) {}

export interface BankPortalResponse {
  id: string
  name: string
  portal_url: string | null
  created_at: string
  updated_at: string
}

// ───── Client Bank Accounts (credenciales) ───────────────────────────────

export const CreateClientBankAccountSchema = z
  .object({
    bankPortalId: z.string().uuid(),
    username: z.string().min(1),
    password: z.string().min(1),
    securityQa: z.string().optional(),
    status: z.enum(CLIENT_BANK_ACCOUNT_STATUSES).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()

export class CreateClientBankAccountDto extends createZodDto(CreateClientBankAccountSchema) {}

export const UpdateClientBankAccountSchema = z
  .object({
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    securityQa: z.string().nullable().optional(),
    status: z.enum(CLIENT_BANK_ACCOUNT_STATUSES).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  })

export class UpdateClientBankAccountDto extends createZodDto(UpdateClientBankAccountSchema) {}

export interface ClientBankAccountResponse {
  id: string
  client_id: string
  bank_portal_id: string
  status: (typeof CLIENT_BANK_ACCOUNT_STATUSES)[number]
  notes: string | null
  created_at: string
  updated_at: string
}

// ───── Global Credentials (v0.16.1) ───────────────────────────────────────

export const ListGlobalCredentialsQuerySchema = z
  .object({
    clientId: z.string().uuid().optional(),
    portalId: z.string().uuid().optional(),
    status: z.enum(CLIENT_BANK_ACCOUNT_STATUSES).optional(),
    search: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()

export class ListGlobalCredentialsQueryDto extends createZodDto(ListGlobalCredentialsQuerySchema) {}

export const CreateGlobalCredentialSchema = z
  .object({
    clientId: z.string().uuid(),
    bankPortalId: z.string().uuid(),
    username: z.string().min(1),
    password: z.string().min(1),
    securityQa: z.string().optional(),
    status: z.enum(CLIENT_BANK_ACCOUNT_STATUSES).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()

export class CreateGlobalCredentialDto extends createZodDto(CreateGlobalCredentialSchema) {}

export interface GlobalCredentialResponse {
  id: string
  client: { id: string; legal_name: string }
  portal: { id: string; name: string; portal_url: string | null }
  status: (typeof CLIENT_BANK_ACCOUNT_STATUSES)[number]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ListGlobalCredentialsResponse {
  items: GlobalCredentialResponse[]
  total: number
  limit: number
  offset: number
}

// ───── Bank Accounts (cuentas individuales) ──────────────────────────────

export const CreateBankAccountSchema = z
  .object({
    accountMask: z.string().length(4),
    accountType: z.enum(BANK_ACCOUNT_TYPES),
    label: z.string().max(200).optional(),
    status: z.enum(BANK_ACCOUNT_STATUSES).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()

export class CreateBankAccountDto extends createZodDto(CreateBankAccountSchema) {}

export const UpdateBankAccountSchema = z
  .object({
    accountMask: z.string().length(4).optional(),
    accountType: z.enum(BANK_ACCOUNT_TYPES).optional(),
    label: z.string().max(200).nullable().optional(),
    status: z.enum(BANK_ACCOUNT_STATUSES).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  })

export class UpdateBankAccountDto extends createZodDto(UpdateBankAccountSchema) {}

export const ChangeBankAccountStatusSchema = z
  .object({
    status: z.enum(BANK_ACCOUNT_STATUSES),
    reason: z.string().max(500).optional(),
  })
  .strict()

export class ChangeBankAccountStatusDto extends createZodDto(ChangeBankAccountStatusSchema) {}

export interface BankAccountResponse {
  id: string
  client_bank_account_id: string
  account_mask: string
  account_type: (typeof BANK_ACCOUNT_TYPES)[number]
  label: string | null
  status: (typeof BANK_ACCOUNT_STATUSES)[number]
  notes: string | null
  created_at: string
  updated_at: string
}
