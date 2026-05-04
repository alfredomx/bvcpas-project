import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { CLIENT_TRANSACTION_CATEGORIES } from '../../../db/schema/client-transactions'
import { FOLLOWUP_STATUSES } from '../../../db/schema/client-period-followups'
import { PUBLIC_LINK_PURPOSES } from '../../../db/schema/client-public-links'
import { CLIENT_TRANSACTIONS_FILTERS } from '../../../db/schema/clients'

// ───── shared ────────────────────────────────────────────────────────────

export const ClientIdQuerySchema = z
  .object({
    clientId: z.string().uuid().describe('UUID del cliente'),
  })
  .describe('Query con clientId requerido')

export class ClientIdQueryDto extends createZodDto(ClientIdQuerySchema) {}

// ───── transactions ──────────────────────────────────────────────────────

export const SyncTransactionsBodySchema = z
  .object({
    clientId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate debe ser YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate debe ser YYYY-MM-DD'),
  })
  .strict()
  .describe('Body para sync con Intuit (cliente + rango de fechas)')

export class SyncTransactionsBodyDto extends createZodDto(SyncTransactionsBodySchema) {}

export const ListTransactionsQuerySchema = z
  .object({
    clientId: z.string().uuid(),
    category: z.enum(CLIENT_TRANSACTION_CATEGORIES).optional(),
    filter: z.enum(CLIENT_TRANSACTIONS_FILTERS).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate debe ser YYYY-MM-DD')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate debe ser YYYY-MM-DD')
      .optional(),
  })
  .describe('Filtros para listar transacciones de un cliente')

export class ListTransactionsQueryDto extends createZodDto(ListTransactionsQuerySchema) {}

const TransactionSchema = z.object({
  id: z.string().uuid(),
  realm_id: z.string(),
  qbo_txn_type: z.string(),
  qbo_txn_id: z.string(),
  client_id: z.string().uuid(),
  txn_date: z.string(),
  docnum: z.string().nullable(),
  vendor_name: z.string().nullable(),
  memo: z.string().nullable(),
  split_account: z.string().nullable(),
  category: z.enum(CLIENT_TRANSACTION_CATEGORIES),
  amount: z.string(),
  synced_at: z.string().datetime(),
})

export class TransactionDto extends createZodDto(TransactionSchema) {}

const TransactionsListResponseSchema = z.object({
  items: z.array(TransactionSchema),
  total: z.number().int(),
})

export class TransactionsListResponseDto extends createZodDto(TransactionsListResponseSchema) {}

const SyncResultSchema = z.object({
  client_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  deleted_count: z.number().int(),
  inserted_count: z.number().int(),
  duration_ms: z.number().int(),
})

export class SyncResultDto extends createZodDto(SyncResultSchema) {}

// ───── responses ─────────────────────────────────────────────────────────

const TransactionResponseSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  realm_id: z.string(),
  qbo_txn_type: z.string(),
  qbo_txn_id: z.string(),
  txn_date: z.string(),
  vendor_name: z.string().nullable(),
  memo: z.string().nullable(),
  split_account: z.string().nullable(),
  category: z.enum(CLIENT_TRANSACTION_CATEGORIES),
  amount: z.string(),
  client_note: z.string(),
  responded_at: z.string().datetime(),
  synced_to_qbo_at: z.string().datetime().nullable(),
})

export class TransactionResponseDto extends createZodDto(TransactionResponseSchema) {}

const TransactionResponsesListSchema = z.object({
  items: z.array(TransactionResponseSchema),
})

export class TransactionResponsesListDto extends createZodDto(TransactionResponsesListSchema) {}

// ───── followups ─────────────────────────────────────────────────────────

export const FollowupQuerySchema = z
  .object({
    clientId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'period debe ser YYYY-MM'),
  })
  .describe('Cliente + periodo (YYYY-MM)')

export class FollowupQueryDto extends createZodDto(FollowupQuerySchema) {}

const FollowupSchema = z.object({
  client_id: z.string().uuid(),
  period: z.string(),
  status: z.enum(FOLLOWUP_STATUSES),
  sent_at: z.string().datetime().nullable(),
  last_reply_at: z.string().datetime().nullable(),
  sent_by_user_id: z.string().uuid().nullable(),
  internal_notes: z.string().nullable(),
})

export class FollowupDto extends createZodDto(FollowupSchema) {}

export const UpdateFollowupSchema = z
  .object({
    status: z.enum(FOLLOWUP_STATUSES).optional(),
    sentAt: z.string().datetime().nullable().optional(),
    lastReplyAt: z.string().datetime().nullable().optional(),
    sentByUserId: z.string().uuid().nullable().optional(),
    internalNotes: z.string().nullable().optional(),
  })
  .strict()
  .describe('Campos a actualizar del followup')

export class UpdateFollowupDto extends createZodDto(UpdateFollowupSchema) {}

// ───── public links ──────────────────────────────────────────────────────

export const CreatePublicLinkSchema = z
  .object({
    clientId: z.string().uuid(),
    purpose: z.enum(PUBLIC_LINK_PURPOSES),
    expiresAt: z.string().datetime().nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    force: z.boolean().optional(),
  })
  .strict()
  .describe('Crear (o reutilizar) un link público para un cliente')

export class CreatePublicLinkDto extends createZodDto(CreatePublicLinkSchema) {}

const PublicLinkSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  token: z.string(),
  purpose: z.enum(PUBLIC_LINK_PURPOSES),
  expires_at: z.string().datetime().nullable(),
  revoked_at: z.string().datetime().nullable(),
  max_uses: z.number().int().nullable(),
  use_count: z.number().int(),
  last_used_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid().nullable(),
})

export class PublicLinkDto extends createZodDto(PublicLinkSchema) {}

const PublicLinksListSchema = z.object({
  items: z.array(PublicLinkSchema),
})

export class PublicLinksListDto extends createZodDto(PublicLinksListSchema) {}

// ───── public (cliente con token) ────────────────────────────────────────

const PublicTransactionSchema = z.object({
  id: z.string().uuid(),
  txn_date: z.string(),
  docnum: z.string().nullable(),
  vendor_name: z.string().nullable(),
  memo: z.string().nullable(),
  split_account: z.string().nullable(),
  category: z.enum(['uncategorized_expense', 'uncategorized_income']), // públicas excluyen AMA
  amount: z.string(),
  client_note: z.string().nullable(),
  responded_at: z.string().datetime().nullable(),
})

export class PublicTransactionDto extends createZodDto(PublicTransactionSchema) {}

const PublicTransactionsResponseSchema = z.object({
  client: z.object({
    id: z.string().uuid(),
    legal_name: z.string(),
    transactions_filter: z.enum(CLIENT_TRANSACTIONS_FILTERS),
  }),
  items: z.array(PublicTransactionSchema),
})

export class PublicTransactionsResponseDto extends createZodDto(PublicTransactionsResponseSchema) {}

export const SaveNoteBodySchema = z
  .object({
    note: z.string().min(1, 'La nota no puede estar vacía').max(5000),
  })
  .strict()
  .describe('Cuerpo del PATCH para guardar nota del cliente')

export class SaveNoteBodyDto extends createZodDto(SaveNoteBodySchema) {}
