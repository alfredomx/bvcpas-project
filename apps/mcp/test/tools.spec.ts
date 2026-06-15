import { describe, it, expect, beforeEach } from 'vitest'
import { MapiClient, MapiError } from '../src/mapi-client'
import {
  bankDownloadTool,
  listClientsTool,
  listPortalsTool,
  listClientAccountsTool,
  listClientTransactionsTool,
  listUncatsTool,
  listAmasTool,
  clearClientCache,
} from '../src/tools'

// El cache de resolución cliente→UUID es a nivel módulo: límpialo entre tests.
beforeEach(() => clearClientCache())

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

/** fetch falso que decide la respuesta según la URL (para tools que hacen 2 llamadas). */
function clientRouter(
  calls: { url: string; init: RequestInit }[],
  route: (url: string) => { status: number; body: unknown },
) {
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const { status, body } = route(String(url))
    return new Response(body === undefined ? '' : JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return new MapiClient({ baseUrl: 'http://localhost:4000', jwt: 'JWT123', fetchFn })
}

const BILIA = 'ebe62603-a2ea-413d-96f2-c6e2c933b488'

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
    await listClientAccountsTool.handler(
      { clientId: 'ebe62603-a2ea-413d-96f2-c6e2c933b488' },
      client,
    )
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ebe62603-a2ea-413d-96f2-c6e2c933b488/banking/credentials',
    )
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
    await listClientAccountsTool.handler(
      { clientId: 'ebe62603-a2ea-413d-96f2-c6e2c933b488', portal: 'chase' },
      client,
    )
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ebe62603-a2ea-413d-96f2-c6e2c933b488/banking/credentials?portal=chase',
    )
  })

  it('CR-mcp-010: list_client_transactions → GET /v1/clients/:id/transactions (id encodeado)', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { items: [], total: 0 })
    const out = await listClientTransactionsTool.handler(
      { clientId: 'ebe62603-a2ea-413d-96f2-c6e2c933b488' },
      client,
    )
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ebe62603-a2ea-413d-96f2-c6e2c933b488/transactions',
    )
    expect(calls[0].init.method).toBe('GET')
    expect(headersOf(calls[0].init).Authorization).toBe('Bearer JWT123')
    expect(JSON.parse(out)).toEqual({ items: [], total: 0 })
  })

  it('CR-mcp-011: list_client_transactions con category=ask_my_accountant (AMAs) → ?category=', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { items: [], total: 0 })
    await listClientTransactionsTool.handler(
      { clientId: 'ebe62603-a2ea-413d-96f2-c6e2c933b488', category: 'ask_my_accountant' },
      client,
    )
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ebe62603-a2ea-413d-96f2-c6e2c933b488/transactions?category=ask_my_accountant',
    )
  })

  it('CR-mcp-012: list_client_transactions con filter + rango de fechas → query string', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientWith(calls, 200, { items: [], total: 0 })
    await listClientTransactionsTool.handler(
      {
        clientId: 'ebe62603-a2ea-413d-96f2-c6e2c933b488',
        filter: 'expense',
        startDate: '2025-01-01',
        endDate: '2026-04-30',
      },
      client,
    )
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/clients/ebe62603-a2ea-413d-96f2-c6e2c933b488/transactions?filter=expense&startDate=2025-01-01&endDate=2026-04-30',
    )
  })
})

describe('list_uncats / list_amas (resuelven nombre → UUID)', () => {
  const TXNS = {
    items: [
      { id: 't1', category: 'uncategorized_expense', vendor_name: 'Dollar Tree', amount: '-3.50' },
      { id: 't2', category: 'uncategorized_income', vendor_name: 'Zelle', amount: '200.00' },
      { id: 't3', category: 'ask_my_accountant', vendor_name: 'Efrain', amount: '-200.00' },
    ],
    total: 3,
  }

  it('CR-mcp-013: list_uncats con UUID → GET transactions directo, filtra a uncats (sin AMA)', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, () => ({ status: 200, body: TXNS }))
    const out = await listUncatsTool.handler({ client: BILIA }, client)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`http://localhost:4000/v1/clients/${BILIA}/transactions`)
    const parsed = JSON.parse(out)
    expect(parsed.total).toBe(2)
    expect(parsed.items.map((t: { id: string }) => t.id)).toEqual(['t1', 't2'])
  })

  it('CR-mcp-014: list_uncats con NOMBRE → resuelve vía /v1/clients?search y luego transactions', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, (url) =>
      url.includes('/transactions')
        ? { status: 200, body: TXNS }
        : {
            status: 200,
            body: { items: [{ id: BILIA, legal_name: 'Bilia Eatery, LLC' }], total: 1 },
          },
    )
    await listUncatsTool.handler({ client: 'bilia' }, client)
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toBe('http://localhost:4000/v1/clients?search=bilia&pageSize=50')
    expect(calls[1].url).toBe(`http://localhost:4000/v1/clients/${BILIA}/transactions`)
  })

  it('CR-mcp-015: list_amas con NOMBRE → resuelve y pide category=ask_my_accountant', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, (url) =>
      url.includes('/transactions')
        ? { status: 200, body: { items: [TXNS.items[2]], total: 1 } }
        : {
            status: 200,
            body: { items: [{ id: BILIA, legal_name: 'Bilia Eatery, LLC' }], total: 1 },
          },
    )
    await listAmasTool.handler({ client: 'bilia' }, client)
    expect(calls[1].url).toBe(
      `http://localhost:4000/v1/clients/${BILIA}/transactions?category=ask_my_accountant`,
    )
  })

  it('CR-mcp-016: nombre sin coincidencias → error claro, no llama transactions', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, () => ({ status: 200, body: { items: [], total: 0 } }))
    await expect(listUncatsTool.handler({ client: 'zzz' }, client)).rejects.toThrow(
      /coincida con "zzz"/,
    )
    expect(calls).toHaveLength(1)
  })

  it('CR-mcp-017: nombre ambiguo (2+ matches) → error que lista las coincidencias', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, () => ({
      status: 200,
      body: {
        items: [
          { id: 'a1', legal_name: 'Art & Beauty Granite, LLC' },
          { id: 'a2', legal_name: 'Arcmen Engineering, LLC' },
        ],
        total: 2,
      },
    }))
    await expect(listUncatsTool.handler({ client: 'ar' }, client)).rejects.toThrow(
      /coincide con 2 clientes/,
    )
    await expect(listUncatsTool.handler({ client: 'ar' }, client)).rejects.toThrow(/a1/)
    expect(calls.every((c) => !c.url.includes('/transactions'))).toBe(true)
  })

  it('CR-mcp-018: resolución por nombre se cachea — 2da llamada no repega a /clients?search', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, (url) =>
      url.includes('/transactions')
        ? { status: 200, body: { items: [], total: 0 } }
        : {
            status: 200,
            body: { items: [{ id: BILIA, legal_name: 'Bilia Eatery, LLC' }], total: 1 },
          },
    )
    await listUncatsTool.handler({ client: 'bilia' }, client)
    await listAmasTool.handler({ client: 'bilia' }, client)
    const searchCalls = calls.filter((c) => c.url.includes('/clients?search'))
    const txnCalls = calls.filter((c) => c.url.includes('/transactions'))
    expect(searchCalls).toHaveLength(1) // solo la 1ra resuelve; la 2da usa cache
    expect(txnCalls).toHaveLength(2)
  })

  it('CR-mcp-019: list_client_accounts acepta nombre → resuelve y pega a /banking/credentials', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, (url) =>
      url.includes('/banking/credentials')
        ? { status: 200, body: [] }
        : {
            status: 200,
            body: { items: [{ id: BILIA, legal_name: 'Bilia Eatery, LLC' }], total: 1 },
          },
    )
    await listClientAccountsTool.handler({ clientId: 'bilia' }, client)
    expect(calls[0].url).toBe('http://localhost:4000/v1/clients?search=bilia&pageSize=50')
    expect(calls[1].url).toBe(`http://localhost:4000/v1/clients/${BILIA}/banking/credentials`)
  })

  it('CR-mcp-020: list_client_transactions acepta nombre → resuelve y pega a /transactions', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = clientRouter(calls, (url) =>
      url.includes('/transactions')
        ? { status: 200, body: { items: [], total: 0 } }
        : {
            status: 200,
            body: { items: [{ id: BILIA, legal_name: 'Bilia Eatery, LLC' }], total: 1 },
          },
    )
    await listClientTransactionsTool.handler({ clientId: 'bilia' }, client)
    expect(calls[1].url).toBe(`http://localhost:4000/v1/clients/${BILIA}/transactions`)
  })
})
