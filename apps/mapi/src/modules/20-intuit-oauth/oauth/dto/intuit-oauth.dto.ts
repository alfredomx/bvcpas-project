import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const AuthorizeResponseSchema = z
  .object({
    authorizationUrl: z.string().url().describe('URL a la que redirigir al admin'),
  })
  .describe('Respuesta con URL de Intuit a la que redirigir')

export class AuthorizeResponseDto extends createZodDto(AuthorizeResponseSchema) {}

const CallbackQuerySchema = z
  .object({
    code: z.string().min(1).describe('Código OAuth devuelto por Intuit'),
    realmId: z.string().min(1).describe('Realm ID del cliente QBO'),
    state: z.string().min(1).describe('State opaco que generó el backend'),
  })
  .describe('Query params del callback de Intuit')

export class CallbackQueryDto extends createZodDto(CallbackQuerySchema) {}

const CallbackResultSchema = z
  .object({
    client_id: z.string().uuid(),
    realm_id: z.string(),
    company_name: z.string(),
    outcome: z.enum(['created', 'reauth-silent', 'reauth-target']),
  })
  .describe('Resultado del flow OAuth')

export class CallbackResultDto extends createZodDto(CallbackResultSchema) {}
