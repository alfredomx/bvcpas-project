/**
 * Definición de los tools MCP. Cada tool es un wrapper delgado: valida poco, reenvía a un
 * endpoint que mapi YA expone, y devuelve el JSON de mapi como texto. El LLM traduce el
 * lenguaje natural ("estados de cuenta de febrero a marzo de bilia") a los args.
 */

import type { MapiClient } from './mapi-client.js'

/** JSON Schema mínimo (el que MCP publica en ListTools). Compatible con Tool.inputSchema del SDK. */
export interface JsonSchema {
  type: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
  [key: string]: unknown
}

export interface ToolDef {
  name: string
  description: string
  inputSchema: JsonSchema
  /** Devuelve texto para el bloque `content` del CallTool. Lanza MapiError si mapi falla. */
  handler: (args: Record<string, unknown>, client: MapiClient) => Promise<string>
}

const pretty = (v: unknown): string => JSON.stringify(v, null, 2)

export const bankDownloadTool: ToolDef = {
  name: 'bank_download',
  description:
    'Descarga bancaria por cliente(s). Encola un job por cliente (async, se ve en bull-board). ' +
    'Para statements usa rango de meses: "mayo" → from y to "2026-05"; "enero a marzo" → ' +
    'from:"2026-01", to:"2026-03"; "desde mayo" → solo from:"2026-05" (hasta el mes actual).',
  inputSchema: {
    type: 'object',
    properties: {
      client: {
        description: 'Nombre o UUID del cliente, o un array de ellos. mapi resuelve el nombre.',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }],
      },
      what: {
        type: 'string',
        enum: ['statements', 'checks', 'deposits', 'transactions'],
        description: 'Qué bajar.',
      },
      params: {
        type: 'object',
        additionalProperties: true,
        description:
          'Parámetros según `what`. statements: { from?, to? (YYYY-MM), latest?, save? }.',
      },
    },
    required: ['client', 'what'],
    additionalProperties: false,
  },
  handler: async (args, client) => {
    const body = {
      client: args.client,
      what: args.what,
      params: (args.params as Record<string, unknown>) ?? {},
    }
    const res = await client.post('/v1/banking/download', body)
    return pretty(res)
  },
}

export const listClientsTool: ToolDef = {
  name: 'list_clients',
  description:
    'Lista los clientes (id, nombre, realm QBO, tier, status). Útil para saber a quién se le ' +
    'puede disparar una descarga antes de llamar bank_download.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async (_args, client) => {
    const res = await client.get('/v1/clients')
    return pretty(res)
  },
}

export const listPortalsTool: ToolDef = {
  name: 'list_portals',
  description: 'Lista los portales bancarios disponibles (Chase, etc.).',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async (_args, client) => {
    const res = await client.get('/v1/banking/portals')
    return pretty(res)
  },
}

export const listClientAccountsTool: ToolDef = {
  name: 'list_client_accounts',
  description:
    'Lista las credenciales/portales bancarios conectados de un cliente (qué bancos tiene). ' +
    'Requiere clientId (UUID).',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del cliente.' },
    },
    required: ['clientId'],
    additionalProperties: false,
  },
  handler: async (args, client) => {
    const clientId = encodeURIComponent(String(args.clientId))
    const res = await client.get(`/v1/clients/${clientId}/banking/credentials`)
    return pretty(res)
  },
}

export const TOOLS: ToolDef[] = [
  bankDownloadTool,
  listClientsTool,
  listPortalsTool,
  listClientAccountsTool,
]

export const TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
)
