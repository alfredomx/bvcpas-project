import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { PROVIDERS } from '../../../db/schema/user-connections'

const CreateApiKeySchema = z
  .object({
    provider: z.enum(PROVIDERS),
    externalAccountId: z.string().min(1).describe('ID propio del provider (merchant_id, etc.)'),
    label: z.string().min(1).max(120).optional(),
    clientId: z.string().uuid().optional().describe('clients.id de BV CPAs (opcional)'),
    credentials: z
      .record(z.string(), z.unknown())
      .describe('JSON con shape definida por el provider concreto'),
  })
  .describe('Body para crear una conexión api_key')

export class CreateApiKeyConnectionDto extends createZodDto(CreateApiKeySchema) {}

const UpdateApiKeySchema = z
  .object({
    credentials: z.record(z.string(), z.unknown()),
  })
  .describe('Body para actualizar credentials de una conexión api_key')

export class UpdateApiKeyConnectionDto extends createZodDto(UpdateApiKeySchema) {}
