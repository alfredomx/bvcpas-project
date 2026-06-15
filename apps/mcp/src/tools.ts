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
    'cada una con el portal (id, nombre, portal_url). `clientId` = nombre o UUID (si das el ' +
    'nombre, ej "bilia", el tool lo resuelve solo). Filtro opcional `portal` (parcial, ' +
    'case-insensitive) para resolver la credencial de un banco en una llamada.',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'Nombre o UUID del cliente.' },
      portal: {
        type: 'string',
        description: 'Filtra por nombre de portal (parcial, case-insensitive). Ej: "chase".',
      },
    },
    required: ['clientId'],
    additionalProperties: false,
  },
  handler: async (args, client) => {
    const clientId = await resolveClientId(args.clientId, client)
    const query = qs({ portal: args.portal })
    const res = await client.get(
      `/v1/clients/${encodeURIComponent(clientId)}/banking/credentials${query}`,
    )
    return pretty(res)
  },
}

export const listClientTransactionsTool: ToolDef = {
  name: 'list_client_transactions',
  description:
    'Lista las transacciones del snapshot de un cliente: los uncats y los AMAs (Ask My ' +
    'Accountant). `clientId` = nombre o UUID (si das el nombre se resuelve solo). El campo `category` ' +
    'separa los tipos: uncats = "uncategorized_expense" + "uncategorized_income"; AMAs = ' +
    '"ask_my_accountant". Sin `category` trae los tres. Cada item incluye date, vendor, memo, ' +
    'account, amount y la nota del cliente si la hay. Filtros opcionales: `filter` ' +
    '(all/income/expense), `startDate`/`endDate` (YYYY-MM-DD). Nota: el snapshot lo llena el ' +
    'sync de customer-support; si viene vacío, el cliente aún no se ha sincronizado.',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'Nombre o UUID del cliente.' },
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
    const clientId = await resolveClientId(args.clientId, client)
    const query = qs({
      category: args.category,
      filter: args.filter,
      startDate: args.startDate,
      endDate: args.endDate,
    })
    const res = await client.get(`/v1/clients/${encodeURIComponent(clientId)}/transactions${query}`)
    return pretty(res)
  },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ClientRow {
  id: string
  legal_name?: string
  legalName?: string
  name?: string
}

/** Extrae el array de clientes del response de GET /v1/clients (items | data | array). */
const clientsOf = (res: unknown): ClientRow[] => {
  if (Array.isArray(res)) return res as ClientRow[]
  const r = res as { items?: ClientRow[]; data?: ClientRow[] }
  return r.items ?? r.data ?? []
}

const clientLabel = (c: ClientRow): string =>
  c.legal_name ?? c.legalName ?? c.name ?? '(sin nombre)'

/**
 * Cache en memoria nombre(normalizado)→UUID. Vive lo que dure el proceso del MCP (stdio,
 * se reinicia seguido), así que el riesgo de quedarse con un id viejo si renombran un cliente es
 * mínimo. Evita repegarle a `/clients?search=` cada vez que se pregunta por el mismo cliente.
 * Solo se cachean resoluciones de 1 match exacto (0/2+ lanzan error y no se cachean).
 */
const clientIdCache = new Map<string, string>()

/** Vacía el cache de resolución de clientes (test/manual). */
export const clearClientCache = (): void => clientIdCache.clear()

/**
 * Resuelve un cliente (UUID o nombre) a su UUID. Resolver REUSABLE — úsalo en cualquier tool que
 * reciba un cliente. Si es UUID lo devuelve tal cual; si es nombre busca con `?search=`
 * (server-side, ilike: "sre" → "SRE Services, LLC") y cachea el resultado en memoria. 0
 * coincidencias o 2+ → lanza Error legible (el chat lo ve como mensaje). Nunca adivina entre
 * varios (decisión del operador, D-mcp-007).
 */
const resolveClientId = async (clientArg: unknown, mapi: MapiClient): Promise<string> => {
  const raw = String(clientArg ?? '').trim()
  if (UUID_RE.test(raw)) return raw
  const key = raw.toLowerCase()
  const cached = clientIdCache.get(key)
  if (cached) return cached
  const res = await mapi.get(`/v1/clients${qs({ search: raw, pageSize: 50 })}`)
  const matches = clientsOf(res)
  if (matches.length === 0) {
    throw new Error(
      `No encontré ningún cliente que coincida con "${raw}". Usa list_clients para ver los nombres.`,
    )
  }
  if (matches.length > 1) {
    const list = matches.map((c) => `- ${clientLabel(c)} → ${c.id}`).join('\n')
    throw new Error(
      `"${raw}" coincide con ${matches.length} clientes. Especifica cuál (nombre exacto o UUID):\n${list}`,
    )
  }
  clientIdCache.set(key, matches[0].id)
  return matches[0].id
}

const clientArgSchema = (verb: string): JsonSchema => ({
  type: 'object',
  properties: {
    client: {
      type: 'string',
      description: `Nombre o UUID del cliente (ej: "Bilia"). Si das el nombre, el tool lo resuelve solo. ${verb}`,
    },
    startDate: { type: 'string', description: 'Fecha inicial YYYY-MM-DD (opcional).' },
    endDate: { type: 'string', description: 'Fecha final YYYY-MM-DD (opcional).' },
  },
  required: ['client'],
  additionalProperties: false,
})

export const listUncatsTool: ToolDef = {
  name: 'list_uncats',
  description:
    'Uncats (transacciones sin categorizar) de un cliente: gastos e ingresos sin clasificar ' +
    '(uncategorized_expense + uncategorized_income), excluye los AMAs. Dale el NOMBRE del cliente ' +
    '(ej: "Bilia") y el tool lo resuelve a UUID solo. Cada item trae fecha, vendor, memo, cuenta, ' +
    'monto y la nota del cliente si la hay. El snapshot lo llena el sync de customer-support; ' +
    'si viene vacío, el cliente aún no se ha sincronizado.',
  inputSchema: clientArgSchema('Para los AMAs usa list_amas.'),
  handler: async (args, mapi) => {
    const clientId = await resolveClientId(args.client, mapi)
    const query = qs({ startDate: args.startDate, endDate: args.endDate })
    const res = await mapi.get(`/v1/clients/${encodeURIComponent(clientId)}/transactions${query}`)
    const all = (res as { items?: { category?: string }[] }).items ?? []
    const items = all.filter(
      (t) => t.category === 'uncategorized_expense' || t.category === 'uncategorized_income',
    )
    return pretty({ items, total: items.length })
  },
}

export const listAmasTool: ToolDef = {
  name: 'list_amas',
  description:
    'AMAs (Ask My Accountant) de un cliente: las transacciones marcadas como "ask_my_accountant" ' +
    '(las que se mandan al contador, no al cliente). Dale el NOMBRE del cliente (ej: "Bilia") y el ' +
    'tool lo resuelve a UUID solo. Cada item trae fecha, vendor, memo, cuenta y monto. El snapshot ' +
    'lo llena el sync de customer-support; si viene vacío, el cliente aún no se ha sincronizado.',
  inputSchema: clientArgSchema('Para los uncats usa list_uncats.'),
  handler: async (args, mapi) => {
    const clientId = await resolveClientId(args.client, mapi)
    const query = qs({
      category: 'ask_my_accountant',
      startDate: args.startDate,
      endDate: args.endDate,
    })
    const res = await mapi.get(`/v1/clients/${encodeURIComponent(clientId)}/transactions${query}`)
    return pretty(res)
  },
}

export const TOOLS: ToolDef[] = [
  bankDownloadTool,
  listClientsTool,
  listPortalsTool,
  listClientAccountsTool,
  listClientTransactionsTool,
  listUncatsTool,
  listAmasTool,
]

export const TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
)
