// Tests retroactivos del cliente HTTP (v0.2.1, Bloque 2).
//
// Ver TDD: apps/bvcpas/roadmap/10-core-auth/v0.2.1.md (Bloque 2).
// Mock estrategia: vi.stubGlobal('fetch', vi.fn(...)) por test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, httpGet, httpPost } from './http'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('http', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('parses 2xx JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { foo: 'bar' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await httpGet<{ foo: string }>('/v1/anything')

    expect(result).toEqual({ foo: 'bar' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws ApiError with code/message/statusCode on non-2xx', async () => {
    // Factory: cada llamada a fetch produce un Response nuevo (los Response
    // se invalidan tras consumirse, no se pueden reusar entre llamadas).
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(401, {
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas',
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpPost('/v1/auth/login', { email: 'a', password: 'b' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Credenciales inválidas',
    })

    // Y la instancia es ApiError, no Error genérico.
    try {
      await httpPost('/v1/auth/login', {})
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
    }
  })

  it('dispatches auth:unauthorized on 401 outside /v1/auth/login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(401, { statusCode: 401, code: 'SESSION_EXPIRED', message: 'expired' }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    await expect(httpGet('/v1/auth/me')).rejects.toBeInstanceOf(ApiError)

    const calls = dispatchSpy.mock.calls.map((c) => (c[0] as Event).type)
    expect(calls).toContain('auth:unauthorized')
  })

  it('does NOT dispatch auth:unauthorized on 401 from /v1/auth/login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'bad' }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    await expect(httpPost('/v1/auth/login', { email: 'a', password: 'b' })).rejects.toBeInstanceOf(
      ApiError,
    )

    const calls = dispatchSpy.mock.calls.map((c) => (c[0] as Event).type)
    expect(calls).not.toContain('auth:unauthorized')
  })

  it('attaches Authorization: Bearer header when token in sessionStorage', async () => {
    window.sessionStorage.setItem('bvcpas.accessToken', 'xyz')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await httpGet('/v1/auth/me')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers).toMatchObject({ Authorization: 'Bearer xyz' })
  })

  it('reads NEXT_PUBLIC_API_URL for baseURL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await httpGet('/v1/foo')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe(`${TEST_BASE_URL}/v1/foo`)
  })
})
