import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { CALL_LOG_OUTCOMES } from '../../../db/schema/client-call-logs'

// ───── Create ────────────────────────────────────────────────────────────

export const CreateCallLogBodySchema = z
  .object({
    outcome: z
      .enum(CALL_LOG_OUTCOMES)
      .describe('Resultado de la llamada. Uno de: responded, no_answer, voicemail, refused, other'),
    notes: z
      .string()
      .max(2000)
      .optional()
      .describe('Notas libres sobre la llamada. Max 2000 caracteres.'),
    called_at: z
      .string()
      .datetime()
      .optional()
      .describe('Timestamp ISO 8601 de cuándo se hizo la llamada. Default: now()'),
  })
  .strict()
  .describe('Body para registrar una llamada (clientId va en path, user_id se toma del JWT)')

export class CreateCallLogBodyDto extends createZodDto(CreateCallLogBodySchema) {}

// ───── Update ────────────────────────────────────────────────────────────

export const UpdateCallLogBodySchema = z
  .object({
    outcome: z.enum(CALL_LOG_OUTCOMES).optional(),
    notes: z.string().max(2000).nullable().optional(),
    called_at: z.string().datetime().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  })
  .describe('Body para actualizar un call log. Al menos un campo requerido.')

export class UpdateCallLogBodyDto extends createZodDto(UpdateCallLogBodySchema) {}

// ───── List query ────────────────────────────────────────────────────────

export const ListCallLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .describe('Paginación de call logs. Default: 20 items, offset 0.')

export class ListCallLogsQueryDto extends createZodDto(ListCallLogsQuerySchema) {}

// ───── Response shape ────────────────────────────────────────────────────

export interface CallLogResponse {
  id: string
  client_id: string
  user_id: string
  called_at: string
  outcome: (typeof CALL_LOG_OUTCOMES)[number]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ListCallLogsResponse {
  items: CallLogResponse[]
  limit: number
  offset: number
}
