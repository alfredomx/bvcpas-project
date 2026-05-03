import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_ROLES, USER_STATUSES } from '../../../db/schema/users'

const MeResponseSchema = z
  .object({
    id: z.string().uuid().describe('ID del usuario'),
    email: z.string().email().describe('Email del usuario'),
    fullName: z.string().describe('Nombre completo'),
    role: z.enum(USER_ROLES).describe('Rol del sistema'),
    status: z.enum(USER_STATUSES).describe('Estado de la cuenta'),
    lastLoginAt: z.string().datetime().nullable().describe('Último login exitoso (ISO)'),
  })
  .describe('Datos del usuario autenticado')

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
