import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const AuthorizeResponseSchema = z
  .object({
    authorizationUrl: z.string().url().describe('URL de consent de Microsoft'),
  })
  .describe('URL de Microsoft a la que redirigir al usuario')

export class MicrosoftAuthorizeResponseDto extends createZodDto(AuthorizeResponseSchema) {}

const CallbackQuerySchema = z
  .object({
    code: z.string().min(1).describe('Código OAuth devuelto por Microsoft'),
    state: z.string().min(1).describe('State opaco que generó el backend'),
  })
  .describe('Query params del callback de Microsoft')

export class MicrosoftCallbackQueryDto extends createZodDto(CallbackQuerySchema) {}

const MeResponseSchema = z
  .object({
    connected: z.boolean(),
    email: z.string().email().optional(),
    scopes: z.string().optional(),
    microsoftUserId: z.string().optional(),
  })
  .describe('Estado de conexión Microsoft del usuario actual')

export class MicrosoftMeResponseDto extends createZodDto(MeResponseSchema) {}

const TestEmailSchema = z
  .object({
    subject: z.string().min(1).max(255).optional(),
    body: z.string().min(1).max(10_000).optional(),
  })
  .describe('Body opcional para el correo de prueba (defaults seguros)')

export class TestEmailDto extends createZodDto(TestEmailSchema) {}

const TestEmailResponseSchema = z
  .object({
    sentTo: z.string().email(),
    sentAt: z.string().datetime(),
  })
  .describe('Confirmación del envío de prueba')

export class TestEmailResponseDto extends createZodDto(TestEmailResponseSchema) {}
