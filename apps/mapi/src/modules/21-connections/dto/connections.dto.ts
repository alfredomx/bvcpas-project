import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { PROVIDERS } from '../../../db/schema/user-connections'

const ListQuerySchema = z
  .object({
    provider: z.enum(PROVIDERS).optional().describe('Filtrar por provider'),
  })
  .describe('Query params para listar conexiones del usuario actual')

export class ListConnectionsQueryDto extends createZodDto(ListQuerySchema) {}

const ConnectionItemSchema = z
  .object({
    id: z.string().uuid(),
    provider: z.enum(PROVIDERS),
    externalAccountId: z.string(),
    email: z.string().email().nullable(),
    label: z.string().nullable(),
    scopes: z.string(),
    accessRole: z
      .enum(['owner', 'shared-read', 'shared-write'])
      .describe('Rol del user actual sobre esta conexión'),
    accessTokenExpiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .describe('Conexión pública (sin tokens) con rol del user actual')

const ListResponseSchema = z
  .object({
    items: z.array(ConnectionItemSchema),
  })
  .describe('Lista de conexiones del usuario')

export class ListConnectionsResponseDto extends createZodDto(ListResponseSchema) {}
export class ConnectionItemDto extends createZodDto(ConnectionItemSchema) {}

const UpdateLabelSchema = z
  .object({
    label: z.string().min(1).max(120).nullable(),
  })
  .describe('Body para actualizar el label de una conexión')

export class UpdateLabelDto extends createZodDto(UpdateLabelSchema) {}

const TestResponseSchema = z
  .object({
    ok: z.literal(true),
    message: z.string(),
  })
  .describe('Resultado del test() del provider')

export class TestConnectionResponseDto extends createZodDto(TestResponseSchema) {}
