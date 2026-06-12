import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_STATUSES } from '../../../db/schema/users'

const LoginSchema = z
  .object({
    email: z.string().email().describe('Email del usuario registrado'),
    password: z.string().min(1).describe('Contraseña del usuario'),
  })
  .describe('Credenciales para login')

export class LoginDto extends createZodDto(LoginSchema) {}

/**
 * v0.15.0: `role` fue removido. Para obtener los permisos del user
 * recién autenticado, llamar `GET /v1/auth/me/permissions`.
 */
const LoginUserSchema = z.object({
  id: z.string().uuid().describe('ID del usuario'),
  email: z.string().email().describe('Email del usuario'),
  fullName: z.string().describe('Nombre completo'),
  status: z.enum(USER_STATUSES).describe('Estado de la cuenta'),
})

const LoginResponseSchema = z
  .object({
    accessToken: z.string().describe('JWT con expiry según JWT_EXPIRES_IN'),
    user: LoginUserSchema,
  })
  .describe('Respuesta exitosa de login')

export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
