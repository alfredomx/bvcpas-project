import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ConnectBodySchema = z
  .object({
    clientId: z.string().uuid().describe('clients.id de BV CPAs al que se asocia el merchant'),
    label: z.string().min(1).max(120).optional(),
  })
  .describe('Body de inicio OAuth Square')

export class SquareConnectDto extends createZodDto(ConnectBodySchema) {}

const AuthorizeResponseSchema = z
  .object({
    authorizationUrl: z.string().url().describe('URL de Square para autorizar'),
  })
  .describe('Respuesta con URL para abrir el consent')

export class SquareAuthorizeResponseDto extends createZodDto(AuthorizeResponseSchema) {}

const CallbackQuerySchema = z
  .object({
    code: z.string().min(1).optional().describe('Authorization code (sólo en éxito)'),
    state: z.string().min(1).describe('State opaco que generó el backend'),
    response_type: z.string().optional(),
    error: z.string().optional().describe('Código de error si el user rechazó'),
    error_description: z.string().optional(),
  })
  .describe('Query params del callback de Square')

export class SquareCallbackQueryDto extends createZodDto(CallbackQuerySchema) {}
