import { describe, it, expect } from 'vitest'
import { MapiClient, MapiError } from '../src/mapi-client'
import {
  bankDownloadTool,
  listClientsTool,
  listPortalsTool,
  listClientAccountsTool,
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
})
