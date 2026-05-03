import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const IntuitCallRequestSchema = z
  .object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).describe('Método HTTP'),
    path: z
      .string()
      .min(1)
      .describe('Path relativo a la base /v3 de Intuit, ej: /company/<realmId>/account/1'),
    body: z.unknown().optional().describe('Body para POST/PUT (JSON arbitrario)'),
  })
  .describe('Request al proxy genérico V3 de Intuit')

export class IntuitCallRequestDto extends createZodDto(IntuitCallRequestSchema) {}

const TokenStatusSchema = z.object({
  client_id: z.string().uuid(),
  realm_id: z.string(),
  access_token_expires_at: z.string().datetime(),
  refresh_token_expires_at: z.string().datetime(),
  last_refreshed_at: z.string().datetime().nullable(),
  days_until_refresh_expiry: z.number(),
})

const TokensListResponseSchema = z
  .object({
    items: z.array(TokenStatusSchema),
  })
  .describe('Lista de status de tokens Intuit (sin secretos)')

export class TokensListResponseDto extends createZodDto(TokensListResponseSchema) {}
