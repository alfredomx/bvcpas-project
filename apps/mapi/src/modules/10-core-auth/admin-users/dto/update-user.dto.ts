import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_STATUSES } from '../../../../db/schema/users'

/**
 * v0.15.0: `role` fue removido. Para cambiar roles del user, usar los
 * endpoints de RBAC:
 *   - POST   /v1/permissions/users/:userId/roles
 *   - DELETE /v1/permissions/users/:userId/roles/:roleId
 */
const UpdateUserSchema = z
  .object({
    fullName: z.string().min(1).optional().describe('Nombre completo'),
    status: z.enum(USER_STATUSES).optional().describe("Estado: 'active' o 'disabled'"),
  })
  .describe('Edita un usuario (no incluye password — usar /reset-password)')

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
