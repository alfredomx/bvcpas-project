import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const LogoutAllResponseSchema = z
  .object({
    sessionsRevokedCount: z.number().int().nonnegative().describe('Sesiones revocadas'),
  })
  .describe('Respuesta de logout-all')

export class LogoutAllResponseDto extends createZodDto(LogoutAllResponseSchema) {}
