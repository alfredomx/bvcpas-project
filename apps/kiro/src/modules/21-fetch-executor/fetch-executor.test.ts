import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkSession, executeFetch } from './fetch-executor'
import { handleBridgeCommand } from './bridge-handler'

// --- Helpers de mock ---

/** Construye una Response-like mockeada para stubbear fetch. */
function mockResponse(opts: {
  ok?: boolean
  status?: number
  headers?: Record<string, string>
  text?: string
  arrayBuffer?: ArrayBuffer
}): Response {
  const headers = new Headers(opts.headers ?? {})
  return {
    ok: opts.ok ?? (opts.status ? opts.status >= 200 && opts.status < 300 : true),
    status: opts.status ?? 200,
    headers,
    text: vi.fn(async () => opts.text ?? ''),
    arrayBuffer: vi.fn(async () => opts.arrayBuffer ?? new ArrayBuffer(0)),
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('executeFetch', () => {
  it('arma el fetch con method/url/headers/body y correlaciona por requestId', async () => {
    const fetchMock = vi.fn(async () =>
      mockResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        text: '{"ok":true}',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeFetch({
      requestId: 'req-1',
      method: 'POST',
      url: 'https://example.com/api/data',
      headers: { Accept: 'application/json' },
      body: '{"q":1}',
    })

    // Se llamó al fetch con exactamente lo que pidió mapi.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/data', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: '{"q":1}',
      credentials: 'include',
    })

    // Respuesta correlacionada por requestId.
    expect(result.requestId).toBe('req-1')
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.headers['content-type']).toBe('application/json')
    expect(result.body).toBe('{"ok":true}')
    expect(result.bodyEncoding).toBe('text')
  })

  it('no incluye body ni para GET cuando no se pasa', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      mockResponse({ status: 200, text: 'ok' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await executeFetch({ requestId: 'r', method: 'GET', url: 'https://example.com/' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init).not.toHaveProperty('body')
    expect(init.method).toBe('GET')
  })

  it('serializa como texto cuando el content-type es JSON o texto', async () => {
    const fetchMock = vi.fn(async () =>
      mockResponse({
        status: 200,
        headers: { 'content-type': 'text/csv; charset=utf-8' },
        text: 'a,b,c',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeFetch({
      requestId: 'csv',
      method: 'GET',
      url: 'https://example.com/report.csv',
    })

    expect(result.bodyEncoding).toBe('text')
    expect(result.body).toBe('a,b,c')
  })

  it('serializa como base64 cuando el content-type es binario (PDF)', async () => {
    // Bytes "PDF" -> base64 conocido.
    const bytes = new Uint8Array([0x50, 0x44, 0x46]) // "PDF"
    const fetchMock = vi.fn(async () =>
      mockResponse({
        status: 200,
        headers: { 'content-type': 'application/pdf' },
        arrayBuffer: bytes.buffer,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeFetch({
      requestId: 'pdf',
      method: 'GET',
      url: 'https://example.com/statement.pdf',
    })

    expect(result.bodyEncoding).toBe('base64')
    // btoa("PDF") === "UERG"
    expect(result.body).toBe('UERG')
    expect(result.ok).toBe(true)
  })

  it('serializa como base64 cuando no hay content-type (desconocido => binario seguro)', async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02])
    const fetchMock = vi.fn(async () =>
      mockResponse({ status: 200, headers: {}, arrayBuffer: bytes.buffer }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeFetch({
      requestId: 'bin',
      method: 'GET',
      url: 'https://example.com/blob',
    })

    expect(result.bodyEncoding).toBe('base64')
  })

  it('devuelve ok:false con status en respuesta no-2xx, sin lanzar', async () => {
    const fetchMock = vi.fn(async () =>
      mockResponse({
        status: 403,
        headers: { 'content-type': 'application/json' },
        text: '{"error":"forbidden"}',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeFetch({
      requestId: 'no2xx',
      method: 'GET',
      url: 'https://example.com/secret',
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
    expect(result.body).toBe('{"error":"forbidden"}')
    expect(result.requestId).toBe('no2xx')
  })

  it('captura error de red devolviendo ok:false, status 0 y error, sin lanzar', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeFetch({
      requestId: 'neterr',
      method: 'GET',
      url: 'https://example.com/down',
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
    expect(result.body).toBe('')
    expect(result.error).toContain('Failed to fetch')
    expect(result.requestId).toBe('neterr')
  })
})

describe('checkSession', () => {
  function stubChromeTabs(urls: string[]) {
    const query = vi.fn(async () => urls.map((url) => ({ url })))
    vi.stubGlobal('chrome', { tabs: { query } })
    return query
  }

  it('detecta sesión cuando existe una pestaña del dominio pedido', async () => {
    stubChromeTabs(['https://example.com/dashboard', 'https://otra.com/x'])

    const result = await checkSession({ bank: 'example.com' })

    expect(result.bank).toBe('example.com')
    expect(result.authenticated).toBe(true)
    expect(result.tabCount).toBe(1)
  })

  it('cuenta múltiples pestañas del mismo dominio (incluye subdominios)', async () => {
    stubChromeTabs(['https://example.com/a', 'https://secure.example.com/b', 'https://nope.org/c'])

    const result = await checkSession({ bank: 'example.com' })

    expect(result.authenticated).toBe(true)
    expect(result.tabCount).toBe(2)
  })

  it('no detecta sesión cuando no hay pestaña del dominio', async () => {
    stubChromeTabs(['https://otra.com/x', 'https://nope.org/y'])

    const result = await checkSession({ bank: 'example.com' })

    expect(result.authenticated).toBe(false)
    expect(result.tabCount).toBe(0)
  })

  it('ignora pestañas sin url (chrome a veces devuelve undefined)', async () => {
    const query = vi.fn(async () => [{ url: undefined }, { url: 'https://example.com/' }])
    vi.stubGlobal('chrome', { tabs: { query } })

    const result = await checkSession({ bank: 'example.com' })

    expect(result.tabCount).toBe(1)
    expect(result.authenticated).toBe(true)
  })

  it('no hace match parcial de dominio (evita falsos positivos)', async () => {
    stubChromeTabs(['https://notexample.com/x', 'https://example.com.evil.org/y'])

    const result = await checkSession({ bank: 'example.com' })

    expect(result.authenticated).toBe(false)
    expect(result.tabCount).toBe(0)
  })
})

describe('handleBridgeCommand', () => {
  it('despacha execute_fetch a executeFetch', async () => {
    const fetchMock = vi.fn(async () =>
      mockResponse({ status: 200, headers: { 'content-type': 'text/plain' }, text: 'hi' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await handleBridgeCommand({
      type: 'execute_fetch',
      instruction: { requestId: 'b1', method: 'GET', url: 'https://example.com/' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ requestId: 'b1', ok: true, body: 'hi' })
  })

  it('despacha check_session a checkSession', async () => {
    const query = vi.fn(async () => [{ url: 'https://example.com/' }])
    vi.stubGlobal('chrome', { tabs: { query } })

    const result = await handleBridgeCommand({
      type: 'check_session',
      instruction: { bank: 'example.com' },
    })

    expect(query).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ bank: 'example.com', authenticated: true })
  })

  it('lanza en comando desconocido', async () => {
    await expect(
      // @ts-expect-error — probamos un type fuera del contrato a propósito
      handleBridgeCommand({ type: 'nope', instruction: {} }),
    ).rejects.toThrow(/desconocido/i)
  })
})
