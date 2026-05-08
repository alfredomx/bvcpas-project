import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ConnectBodySchema = z
  .object({
    label: z.string().min(1).max(120).optional().describe('Etiqueta humana opcional'),
  })
  .describe('Body opcional al iniciar OAuth Dropbox')

export class DropboxConnectDto extends createZodDto(ConnectBodySchema) {}

const AuthorizeResponseSchema = z
  .object({
    authorizationUrl: z.string().url().describe('URL de consent de Dropbox'),
  })
  .describe('Respuesta con URL para abrir el consent')

export class DropboxAuthorizeResponseDto extends createZodDto(AuthorizeResponseSchema) {}

const CallbackQuerySchema = z
  .object({
    code: z.string().min(1).describe('Authorization code devuelto por Dropbox'),
    state: z.string().min(1).describe('State opaco que generó el backend'),
  })
  .describe('Query params del callback de Dropbox')

export class DropboxCallbackQueryDto extends createZodDto(CallbackQuerySchema) {}

const ListFilesQuerySchema = z
  .object({
    path: z
      .string()
      .default('')
      .describe('Path del Dropbox del owner. Vacío = raíz. Ej: "/Recibos/2026"'),
  })
  .describe('Query para listar archivos')

export class DropboxListFilesQueryDto extends createZodDto(ListFilesQuerySchema) {}

const FileEntrySchema = z.object({
  type: z.enum(['file', 'folder']),
  name: z.string(),
  path: z.string().describe('Path lower-case canonical de Dropbox'),
  id: z.string().describe('ID interno de Dropbox (id:xxxxx)'),
  size: z.number().int().nullable().describe('Bytes (null para folders)'),
  modified: z.string().nullable().describe('ISO timestamp del último cambio (null para folders)'),
})

const ListFilesResponseSchema = z
  .object({
    items: z.array(FileEntrySchema),
    cursor: z
      .string()
      .nullable()
      .describe('Cursor de Dropbox para paginación / sync incremental (null si no hay más)'),
    has_more: z.boolean(),
  })
  .describe('Listado de carpeta de Dropbox')

export class DropboxListFilesResponseDto extends createZodDto(ListFilesResponseSchema) {}
