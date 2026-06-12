import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * DTOs de pause/resume (v0.14.0).
 *
 * Pause body: reason opcional (string corta, máx 200 chars).
 * Resume body: vacío.
 */

export const PauseBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

export class PauseBodyDto extends createZodDto(PauseBodySchema) {}
