import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1).describe('Contraseña actual del usuario'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .describe('Nueva contraseña (mínimo 8 caracteres)'),
  })
  .describe('Cambio de contraseña self-service')

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
