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

/** Arma `?a=1&b=2` desde los args; omite undefined/null/'' y encodea. '' si no hay nada. */
const qs = (params: Record<string, unknown>): string => {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

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
    'Lista los clientes (id, nombre, realm QBO, tier, status). La respuesta es paginada ' +
    '(trae `total`, `page`, `pageSize`). Para ENCONTRAR un cliente por nombre usa `search` ' +
    '(filtra server-side, 1 llamada) — no escanees la lista. Para navegar todos, usa ' +
    '`page`/`pageSize`.',
  inputSchema: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description:
          'Filtro por nombre (match parcial, case-insensitive). Ej: "sre" → SRE Services, LLC.',
      },
      page: { type: 'number', description: 'Página (>=1, default 1).' },
      pageSize: { type: 'number', description: 'Tamaño de página (1-200, default 50).' },
    },
    additionalProperties: false,
  },
  handler: async (args, client) => {
    const query = qs({ search: args.search, page: args.page, pageSize: args.pageSize })
    const res = await client.get(`/v1/clients${query}`)
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
    'Lista las credenciales/portales bancarios conectados de un cliente (qué bancos tiene), ' +
    'cada una con el portal (id, nombre, portal_url). Requiere clientId (UUID). Filtro opcional ' +
    '`portal` (parcial, case-insensitive) para resolver la credencial de un banco en una llamada.',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del cliente.' },
      portal: {
        type: 'string',
        description: 'Filtra por nombre de portal (parcial, case-insensitive). Ej: "chase".',
      },
    },
    required: ['clientId'],
    additionalProperties: false,
  },
  handler: async (args, client) => {
    const clientId = encodeURIComponent(String(args.clientId))
    const query = qs({ portal: args.portal })
    const res = await client.get(`/v1/clients/${clientId}/banking/credentials${query}`)
    return pretty(res)
  },
}

export const listClientTransactionsTool: ToolDef = {
  name: 'list_client_transactions',
  description:
    'Lista las transacciones del snapshot de un cliente: los uncats y los AMAs (Ask My ' +
    'Accountant). Requiere clientId (UUID — encuéntralo con list_clients). El campo `category` ' +
    'separa los tipos: uncats = "uncategorized_expense" + "uncategorized_income"; AMAs = ' +
    '"ask_my_accountant". Sin `category` trae los tres. Cada item incluye date, vendor, memo, ' +
    'account, amount y la nota del cliente si la hay. Filtros opcionales: `filter` ' +
    '(all/income/expense), `startDate`/`endDate` (YYYY-MM-DD). Nota: el snapshot lo llena el ' +
    'sync de customer-support; si viene vacío, el cliente aún no se ha sincronizado.',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del cliente.' },
      category: {
        type: 'string',
        enum: ['uncategorized_expense', 'uncategorized_income', 'ask_my_accountant'],
        description:
          'Tipo de transacción. Para "los AMAs" usa "ask_my_accountant". Para "los uncats" ' +
          'omite category (trae expense + income) o pide un tipo específico.',
      },
      filter: {
        type: 'string',
        enum: ['all', 'income', 'expense'],
        description: 'Filtro income/expense/all (alternativa a category cuando no pides AMAs).',
      },
      startDate: { type: 'string', description: 'Fecha inicial YYYY-MM-DD (opcional).' },
      endDate: { type: 'string', description: 'Fecha final YYYY-MM-DD (opcional).' },
    },
    required: ['clientId'],
    additionalProperties: false,
  },
  handler: async (args, client) => {
    const clientId = encodeURIComponent(String(args.clientId))
    const query = qs({
      category: args.category,
      filter: args.filter,
      startDate: args.startDate,
      endDate: args.endDate,
    })
    const res = await client.get(`/v1/clients/${clientId}/transactions${query}`)
    return pretty(res)
  },
}

export const TOOLS: ToolDef[] = [
  bankDownloadTool,
  listClientsTool,
  listPortalsTool,
  listClientAccountsTool,
  listClientTransactionsTool,
]

export const TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
)
