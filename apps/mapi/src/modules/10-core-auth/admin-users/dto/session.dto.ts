import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const SessionSchema = z
  .object({
    id: z.string().uuid().describe('ID de la sesión'),
    userId: z.string().uuid().describe('ID del usuario dueño'),
    userAgent: z.string().nullable().describe('User agent del cliente'),
    ip: z.string().nullable().describe('IP del login'),
    createdAt: z.string().datetime().describe('Cuándo se creó'),
    lastSeenAt: z.string().datetime().describe('Última actividad'),
    revokedAt: z.string().datetime().nullable().describe('Cuándo se revocó'),
    expiresAt: z.string().datetime().describe('Cuándo expira'),
  })
  .describe('Sesión activa o revocada de un usuario')

export class SessionDto extends createZodDto(SessionSchema) {}

const SessionsListResponseSchema = z
  .object({
    items: z.array(SessionSchema).describe('Sesiones del usuario'),
  })
  .describe('Listado de sesiones de un usuario')

export class SessionsListResponseDto extends createZodDto(SessionsListResponseSchema) {}

const RevokeAllResponseSchema = z
  .object({
    sessionsRevokedCount: z.number().int().nonnegative().describe('Sesiones revocadas'),
  })
  .describe('Respuesta de revoke-all')

export class RevokeAllResponseDto extends createZodDto(RevokeAllResponseSchema) {}
