import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_ROLES } from '../../../../db/schema/users'

const CreateUserSchema = z
  .object({
    email: z.string().email().describe('Email único del nuevo usuario'),
    fullName: z.string().min(1).describe('Nombre completo'),
    role: z.enum(USER_ROLES).describe("Rol: 'admin' o 'viewer'"),
    initialPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .optional()
      .describe(
        'Password inicial. Si se omite, se genera una aleatoria y se devuelve en la response (UNA vez).',
      ),
  })
  .describe('Crea un usuario nuevo (solo admin)')

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
