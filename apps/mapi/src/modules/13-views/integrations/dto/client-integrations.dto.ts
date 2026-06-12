import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * DTOs del dashboard de integraciones (v0.14.0).
 * Endpoint: GET /v1/clients/:id/integrations
 */

const STATUS_VALUES = ['healthy', 'needs_reauth', 'paused'] as const
const PROVIDER_VALUES = ['clover', 'square'] as const
const AUTH_TYPE_VALUES = ['oauth', 'api_key'] as const

const IntegrationConnectionItemSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(PROVIDER_VALUES),
  providerLabel: z.string(),
  label: z.string().nullable(),
  externalAccountId: z.string(),
  authType: z.enum(AUTH_TYPE_VALUES),
  status: z.enum(STATUS_VALUES),
  statusReason: z.string().nullable(),
  pausedAt: z.string().datetime().nullable(),
  pausedReason: z.string().nullable(),
  lastSyncAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

const IntegrationStatsSchema = z.object({
  connected: z.number().int(),
  healthy: z.number().int(),
  needsAttention: z.number().int(),
  errors: z.number().int(),
  providersInUse: z.number().int(),
})

const ClientHeaderSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
})

export const ClientIntegrationsResponseSchema = z.object({
  client: ClientHeaderSchema,
  stats: IntegrationStatsSchema,
  connections: z.array(IntegrationConnectionItemSchema),
})

export class ClientIntegrationsResponseDto extends createZodDto(ClientIntegrationsResponseSchema) {}
