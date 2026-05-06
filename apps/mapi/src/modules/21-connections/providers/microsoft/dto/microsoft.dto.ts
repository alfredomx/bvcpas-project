import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ConnectBodySchema = z
  .object({
    label: z.string().min(1).max(120).optional().describe('Etiqueta humana opcional'),
  })
  .describe('Body opcional al iniciar OAuth Microsoft')

export class MicrosoftConnectDto extends createZodDto(ConnectBodySchema) {}

const AuthorizeResponseSchema = z
  .object({
    authorizationUrl: z.string().url().describe('URL de consent de Microsoft'),
  })
  .describe('Respuesta con URL para abrir el consent')

export class MicrosoftAuthorizeResponseDto extends createZodDto(AuthorizeResponseSchema) {}

const CallbackQuerySchema = z
  .object({
    code: z.string().min(1).describe('Authorization code devuelto por Microsoft'),
    state: z.string().min(1).describe('State opaco que generó el backend'),
  })
  .describe('Query params del callback de Microsoft')

export class MicrosoftCallbackQueryDto extends createZodDto(CallbackQuerySchema) {}
