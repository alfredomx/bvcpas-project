import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_STATUSES } from '../../../db/schema/users'

/**
 * v0.15.0: el campo `role` fue removido. Para obtener permisos del user
 * autenticado, usar `GET /v1/auth/me/permissions` (endpoint que devuelve
 * los permisos efectivos expandidos desde RBAC).
 */
const MeResponseSchema = z
  .object({
    id: z.string().uuid().describe('ID del usuario'),
    email: z.string().email().describe('Email del usuario'),
    fullName: z.string().describe('Nombre completo'),
    status: z.enum(USER_STATUSES).describe('Estado de la cuenta'),
    lastLoginAt: z.string().datetime().nullable().describe('Último login exitoso (ISO)'),
  })
  .describe('Datos del usuario autenticado')

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
