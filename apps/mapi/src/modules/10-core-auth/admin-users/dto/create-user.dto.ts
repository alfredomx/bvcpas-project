import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * v0.15.0: `role` fue removido. El user se crea sin permisos por default.
 * Para asignarle roles después: `POST /v1/permissions/users/:userId/roles`.
 *
 * Opcionalmente se pueden enviar `roleIds[]` para asignarlos en el mismo
 * request (atómico en el service).
 */
const CreateUserSchema = z
  .object({
    email: z.string().email().describe('Email único del nuevo usuario'),
    fullName: z.string().min(1).describe('Nombre completo'),
    initialPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .optional()
      .describe(
        'Password inicial. Si se omite, se genera una aleatoria y se devuelve en la response (UNA vez).',
      ),
    roleIds: z
      .array(z.string().uuid())
      .optional()
      .describe(
        'IDs de roles RBAC para asignar al user. Si se omite, el user queda sin permisos hasta que un admin se los asigne.',
      ),
  })
  .describe('Crea un usuario nuevo (requiere system.users.manage)')

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
