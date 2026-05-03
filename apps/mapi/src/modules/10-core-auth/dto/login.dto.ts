import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_ROLES, USER_STATUSES } from '../../../db/schema/users'

const LoginSchema = z
  .object({
    email: z.string().email().describe('Email del usuario registrado'),
    password: z.string().min(1).describe('Contraseña del usuario'),
  })
  .describe('Credenciales para login')

export class LoginDto extends createZodDto(LoginSchema) {}

const LoginUserSchema = z.object({
  id: z.string().uuid().describe('ID del usuario'),
  email: z.string().email().describe('Email del usuario'),
  fullName: z.string().describe('Nombre completo'),
  role: z.enum(USER_ROLES).describe('Rol del sistema'),
  status: z.enum(USER_STATUSES).describe('Estado de la cuenta'),
})

const LoginResponseSchema = z
  .object({
    accessToken: z.string().describe('JWT con expiry según JWT_EXPIRES_IN'),
    user: LoginUserSchema,
  })
  .describe('Respuesta exitosa de login')

export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
