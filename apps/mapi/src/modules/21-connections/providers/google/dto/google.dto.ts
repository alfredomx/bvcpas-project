import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ConnectBodySchema = z
  .object({
    label: z.string().min(1).max(120).optional().describe('Etiqueta humana opcional'),
  })
  .describe('Body opcional al iniciar OAuth Google')

export class GoogleConnectDto extends createZodDto(ConnectBodySchema) {}

const AuthorizeResponseSchema = z
  .object({
    authorizationUrl: z.string().url().describe('URL de consent de Google'),
  })
  .describe('Respuesta con URL para abrir el consent')

export class GoogleAuthorizeResponseDto extends createZodDto(AuthorizeResponseSchema) {}

const CallbackQuerySchema = z
  .object({
    code: z.string().min(1).describe('Authorization code devuelto por Google'),
    state: z.string().min(1).describe('State opaco que generó el backend'),
    scope: z.string().optional().describe('Scopes que el user efectivamente concedió'),
  })
  .describe('Query params del callback de Google')

export class GoogleCallbackQueryDto extends createZodDto(CallbackQuerySchema) {}

const ListFilesQuerySchema = z
  .object({
    folderId: z
      .string()
      .default('root')
      .describe('ID de la carpeta a listar. "root" = My Drive raíz'),
    pageSize: z.coerce.number().int().min(1).max(1000).default(100),
  })
  .describe('Query para listar archivos de Drive')

export class GoogleListFilesQueryDto extends createZodDto(ListFilesQuerySchema) {}

const FileEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  type: z.enum(['file', 'folder']),
  size: z.number().int().nullable(),
  modified: z.string().nullable(),
})

const ListFilesResponseSchema = z
  .object({
    items: z.array(FileEntrySchema),
    nextPageToken: z.string().nullable(),
  })
  .describe('Listado de carpeta de Drive')

export class GoogleListFilesResponseDto extends createZodDto(ListFilesResponseSchema) {}
