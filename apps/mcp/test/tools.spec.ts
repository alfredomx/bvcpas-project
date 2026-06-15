import { describe, it, expect } from 'vitest'
import { MapiClient, MapiError } from '../src/mapi-client'
import {
  bankDownloadTool,
  listClientsTool,
  listPortalsTool,
  listClientAccountsTool,
  listClientTransactionsTool,
} from '../src/tools'

/** fetch falso que registra la llamada y responde lo que se le configure. */
function fakeFetch(
  calls: { url: string; init: RequestInit }[],
  responder: () => { status: number; body: unknown },
): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const { status, body } = responder()
    return new Response(body === undefined ? '' : JSON.stringify(body), { status })
  }) as unknown as typeof fetch
}

function clientWith(calls: { url: string; init: RequestInit }[], status = 200, body: unknown = {}) {
  return new MapiClient({
    baseUrl: 'http://localhost:4000',
    jwt: 'JWT123',
    fetchFn: fakeFetch(calls, () => ({ status, body })),
  })
}

const headersOf = (init: RequestInit) => init.headers as Record<string, string>

describe('bank_download', () => {
  it('CR-mcp-001: POST /v1/banking/download con client/what/params y Bearer', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { what: 'statements', jobs: [{ jobId: '1' }] })

    const out = await bankDownloadTool.handler(
      {
        client: 'bilia',
        what: 'statements',
        params: { from: '2026-02', to: '2026-03', save: true },
      },
      client,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://localhost:4000/v1/banking/download')
    expect(calls[0].init.method).toBe('POST')
    expect(headersOf(calls[0].init).Authorization).toBe('Bearer JWT123')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      client: 'bilia',
      what: 'statements',
      params: { from: '2026-02', to: '2026-03', save: true },
    })
    expect(JSON.parse(out)).toEqual({ what: 'statements', jobs: [{ jobId: '1' }] })
  })

  it('CR-mcp-002: acepta array de clientes y params por defecto {}', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { jobs: [] })

    await bankDownloadTool.handler({ client: ['bilia', 'sre'], what: 'checks' }, client)

    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      client: ['bilia', 'sre'],
      what: 'checks',
      params: {},
    })
  })

  it('CR-mcp-003: error de mapi se propaga como MapiError con mensaje legible', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 404, { message: 'Cliente no resuelto', code: 'X' })

    await expect(
      bankDownloadTool.handler({ client: 'zzz', what: 'statements' }, client),
    ).rejects.toMatchObject({ status: 404, message: 'mapi 404: Cliente no resuelto' })
    await expect(
      bankDownloadTool.handler({ client: 'zzz', what: 'statements' }, client),
    ).rejects.toBeInstanceOf(MapiError)
  })
})

describe('tools de lectura', () => {
  it('CR-mcp-004: list_clients → GET /v1/clients', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, [{ id: 'c1' }])
    const out = await listClientsTool.handler({}, client)

    expect(calls[0].url).toBe('http://localhost:4000/v1/clients')
    expect(calls[0].init.method).toBe('GET')
    expect(headersOf(calls[0].init).Authorization).toBe('Bearer JWT123')
    expect(JSON.parse(out)).toEqual([{ id: 'c1' }])
  })

  it('CR-mcp-005: list_portals → GET /v1/banking/portals', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, [{ id: 'chase' }])
    await listPortalsTool.handler({}, client)
    expect(calls[0].url).toBe('http://localhost:4000/v1/banking/portals')
    expect(calls[0].init.method).toBe('GET')
  })

  it('CR-mcp-006: list_client_accounts → GET /v1/clients/:id/banking/credentials (id encodeado)', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, [])
    await listClientAccountsTool.handler({ clientId: 'ad390fdb-1' }, client)
    expect(calls[0].url).toBe('http://localhost:4000/v1/clients/ad390fdb-1/banking/credentials')
    expect(calls[0].init.method).toBe('GET')
  })

  it('CR-mcp-007: list_clients con search → GET /v1/clients?search=sre', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { data: [], total: 1 })
    await listClientsTool.handler({ search: 'sre' }, client)
    expect(calls[0].url).toBe('http://localhost:4000/v1/clients?search=sre')
  })

  it('CR-mcp-008: list_clients con page+pageSize → query string correcto', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { data: [] })
    await listClientsTool.handler({ page: 2, pageSize: 100 }, client)
    expect(calls[0].url).toBe('http://localhost:4000/v1/clients?page=2&pageSize=100')
  })

  it('CR-mcp-009: list_client_accounts con portal → ?portal=chase', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { data: [] })
    await listClientAccountsTool.handler({ clientId: 'ad390fdb-1', portal: 'chase' }, client)
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ad390fdb-1/banking/credentials?portal=chase',
    )
  })

  it('CR-mcp-010: list_client_transactions → GET /v1/clients/:id/transactions (id encodeado)', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { items: [], total: 0 })
    const out = await listClientTransactionsTool.handler({ clientId: 'ad390fdb-1' }, client)
    expect(calls[0].url).toBe('http://localhost:4000/v1/clients/ad390fdb-1/transactions')
    expect(calls[0].init.method).toBe('GET')
    expect(headersOf(calls[0].init).Authorization).toBe('Bearer JWT123')
    expect(JSON.parse(out)).toEqual({ items: [], total: 0 })
  })

  it('CR-mcp-011: list_client_transactions con category=ask_my_accountant (AMAs) → ?category=', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { items: [], total: 0 })
    await listClientTransactionsTool.handler(
      { clientId: 'ad390fdb-1', category: 'ask_my_accountant' },
      client,
    )
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ad390fdb-1/transactions?category=ask_my_accountant',
    )
  })

  it('CR-mcp-012: list_client_transactions con filter + rango de fechas → query string', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { items: [], total: 0 })
    await listClientTransactionsTool.handler(
      { clientId: 'ad390fdb-1', filter: 'expense', startDate: '2025-01-01', endDate: '2026-04-30' },
      client,
    )
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ad390fdb-1/transactions?filter=expense&startDate=2025-01-01&endDate=2026-04-30',
    )
  })
})
