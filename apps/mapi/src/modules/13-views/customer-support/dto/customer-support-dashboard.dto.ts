import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { CLIENT_TIERS, CLIENT_TRANSACTIONS_FILTERS } from '../../../../db/schema/clients'
import { FOLLOWUP_STATUSES } from '../../../../db/schema/client-period-followups'

export const DashboardQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from debe ser YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to debe ser YYYY-MM-DD'),
  })
  .describe('Rango requerido para el dashboard')

export class DashboardQueryDto extends createZodDto(DashboardQuerySchema) {}

const MonthlyDataPointSchema = z.object({
  month: z.number().int().min(1).max(12),
  uncats: z.number().int(),
  amas: z.number().int(),
})

const PreviousYearTotalSchema = z.object({
  uncats: z.number().int(),
  amas: z.number().int(),
})

const FollowupSummarySchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES),
  sent_at: z.string().datetime().nullable(),
})

const StatsSchema = z.object({
  uncats_count: z.number().int(),
  amas_count: z.number().int(),
  responded_count: z.number().int(),
  progress_pct: z.number(),
  amount_total: z.string(),
  last_synced_at: z.string().datetime().nullable(),
})

const MonthlySchema = z.object({
  previous_year_total: PreviousYearTotalSchema,
  by_month: z.array(MonthlyDataPointSchema),
})

const ListItemSchema = z.object({
  client_id: z.string().uuid(),
  legal_name: z.string(),
  tier: z.enum(CLIENT_TIERS),
  qbo_realm_id: z.string().nullable(),
  followup: FollowupSummarySchema,
  stats: StatsSchema,
  monthly: MonthlySchema,
})

const ListResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  items: z.array(ListItemSchema),
})

export class CustomerSupportListResponseDto extends createZodDto(ListResponseSchema) {}

const DetailFollowupSchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES),
  sent_at: z.string().datetime().nullable(),
  last_reply_at: z.string().datetime().nullable(),
  internal_notes: z.string().nullable(),
})

const DetailStatsSchema = StatsSchema.extend({
  silent_streak_days: z.number().int(),
})

const DetailClientSchema = z.object({
  id: z.string().uuid(),
  legal_name: z.string(),
  tier: z.enum(CLIENT_TIERS),
  qbo_realm_id: z.string().nullable(),
  primary_contact_name: z.string().nullable(),
  primary_contact_email: z.string().nullable(),
  transactions_filter: z.enum(CLIENT_TRANSACTIONS_FILTERS),
  draft_email_enabled: z.boolean(),
  cc_email: z.string().nullable(),
})

const PublicLinkSchema = z
  .object({
    token: z.string(),
    url: z.string().url(),
    label: z.string().nullable(),
    expires_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
  })
  .nullable()

const DetailResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  client: DetailClientSchema,
  followup: DetailFollowupSchema,
  stats: DetailStatsSchema,
  monthly: MonthlySchema,
  public_link: PublicLinkSchema,
})

export class CustomerSupportDetailResponseDto extends createZodDto(DetailResponseSchema) {}
