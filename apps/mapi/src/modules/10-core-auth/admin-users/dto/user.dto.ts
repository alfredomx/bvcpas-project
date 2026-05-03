import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { USER_ROLES, USER_STATUSES } from '../../../../db/schema/users'

const UserSchema = z
  .object({
    id: z.string().uuid().describe('ID del usuario'),
    email: z.string().email().describe('Email del usuario'),
    fullName: z.string().describe('Nombre completo'),
    role: z.enum(USER_ROLES).describe('Rol del sistema'),
    status: z.enum(USER_STATUSES).describe('Estado de la cuenta'),
    lastLoginAt: z.string().datetime().nullable().describe('Último login (ISO)'),
    createdAt: z.string().datetime().describe('Fecha de creación (ISO)'),
    updatedAt: z.string().datetime().describe('Última actualización (ISO)'),
  })
  .describe('Datos públicos de un usuario (sin password_hash)')

export class UserDto extends createZodDto(UserSchema) {}

const UsersListResponseSchema = z
  .object({
    items: z.array(UserSchema).describe('Usuarios de la página'),
    total: z.number().int().nonnegative().describe('Total de usuarios'),
    page: z.number().int().positive().describe('Página actual'),
    pageSize: z.number().int().positive().describe('Tamaño de página'),
  })
  .describe('Listado paginado de usuarios')

export class UsersListResponseDto extends createZodDto(UsersListResponseSchema) {}

const CreateUserResponseSchema = z
  .object({
    user: UserSchema,
    initialPassword: z
      .string()
      .describe('Password inicial generada (UNA vez). Pasársela al usuario por canal seguro.'),
  })
  .describe('Respuesta de creación de usuario')

export class CreateUserResponseDto extends createZodDto(CreateUserResponseSchema) {}

const ResetPasswordResponseSchema = z
  .object({
    temporaryPassword: z
      .string()
      .describe('Password temporal (UNA vez). El user debe cambiarla en su primer login.'),
  })
  .describe('Respuesta de reset password admin')

export class ResetPasswordResponseDto extends createZodDto(ResetPasswordResponseSchema) {}
