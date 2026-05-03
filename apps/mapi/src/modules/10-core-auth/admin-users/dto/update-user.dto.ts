import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_ROLES, USER_STATUSES } from '../../../../db/schema/users'

const UpdateUserSchema = z
  .object({
    fullName: z.string().min(1).optional().describe('Nombre completo'),
    role: z.enum(USER_ROLES).optional().describe("Rol: 'admin' o 'viewer'"),
    status: z.enum(USER_STATUSES).optional().describe("Estado: 'active' o 'disabled'"),
  })
  .describe('Edita un usuario (no incluye password — usar /reset-password)')

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
