// Tests del SDK tipado (`@/lib/api/client`).
// v0.3.2, Bloque 3.
//
// Verifica los dos middlewares del cliente:
//   1. auth — inyecta `Authorization: Bearer <token>` desde sessionStorage.
//   2. unauthorized — en 401 a paths != /v1/auth/login dispatcha
//      `auth:unauthorized` (espejo de la lógica de http.ts).
//
// Estrategia de mock:
//   - vi.stubEnv('NEXT_PUBLIC_API_URL', ...) ANTES del import dinámico
//     porque `createClient<paths>()` lee el env al construirse.
//   - vi.stubGlobal('fetch', vi.fn(...)) por test.
//   - vi.resetModules() entre tests para que cada uno reciba un
//     cliente nuevo con el env actualizado.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'
const TOKEN_KEY = 'bvcpas.accessToken'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function importApi(): Promise<typeof import('./client').api> {
  const mod = await import('./client')
  return mod.api
}

describe('@/lib/api/client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('injects Authorization header when token is present', async () => {
    window.sessionStorage.setItem(TOKEN_KEY, 'abc.def.ghi')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchMock)

    const api = await importApi()
    await api.GET('/v1/clients')

    const [calledRequest] = fetchMock.mock.calls[0]
    expect(calledRequest.headers.get('Authorization')).toBe('Bearer abc.def.ghi')
  })

  it('does not inject Authorization when no token in sessionStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchMock)

    const api = await importApi()
    await api.GET('/v1/clients')

    const [calledRequest] = fetchMock.mock.calls[0]
    expect(calledRequest.headers.get('Authorization')).toBeNull()
  })

  it('dispatches auth:unauthorized on 401 to a non-login path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { statusCode: 401, code: 'UNAUTHORIZED' }))
    vi.stubGlobal('fetch', fetchMock)

    const listener = vi.fn()
    window.addEventListener('auth:unauthorized', listener)

    const api = await importApi()
    await api.GET('/v1/clients')

    window.removeEventListener('auth:unauthorized', listener)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does NOT dispatch auth:unauthorized on 401 to /v1/auth/login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { statusCode: 401, code: 'INVALID_CREDENTIALS' }))
    vi.stubGlobal('fetch', fetchMock)

    const listener = vi.fn()
    window.addEventListener('auth:unauthorized', listener)

    const api = await importApi()
    await api.POST('/v1/auth/login', {
      body: { email: 'a@b.com', password: 'wrong' },
    })

    window.removeEventListener('auth:unauthorized', listener)
    expect(listener).not.toHaveBeenCalled()
  })
})
