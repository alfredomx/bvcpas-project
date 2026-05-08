import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const PermissionSchema = z.enum(['read', 'write']).describe('Nivel de acceso compartido')

const ShareConnectionSchema = z
  .object({
    user_id: z.string().uuid().describe('UUID del user invitado'),
    permission: PermissionSchema,
  })
  .describe('Comparte la conexión con otro user')

export class ShareConnectionDto extends createZodDto(ShareConnectionSchema) {}

const UpdateShareSchema = z
  .object({
    permission: PermissionSchema,
  })
  .describe('Cambia el permission de un share existente')

export class UpdateShareDto extends createZodDto(UpdateShareSchema) {}

const ShareItemSchema = z.object({
  connection_id: z.string().uuid(),
  user_id: z.string().uuid(),
  permission: PermissionSchema,
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    full_name: z.string(),
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export class ConnectionShareDto extends createZodDto(ShareItemSchema) {}

const ListSharesResponseSchema = z.object({
  items: z.array(ShareItemSchema),
})

export class ListSharesResponseDto extends createZodDto(ListSharesResponseSchema) {}
