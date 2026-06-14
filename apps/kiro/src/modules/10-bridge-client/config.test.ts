import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_BRIDGE_URL,
  httpBaseFromBridgeUrl,
  loginToMapi,
  readBridgeConfig,
  setBridgeToken,
  setBridgeUrl,
  STORAGE_KEY_TOKEN,
  STORAGE_KEY_URL,
} from './config'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubStorage(initial: Record<string, unknown> = {}) {
  const store = { ...initial }
  const get = vi.fn(async (keys: string[]) => {
    const out: Record<string, unknown> = {}
    for (const k of keys) if (k in store) out[k] = store[k]
    return out
  })
  const set = vi.fn(async (obj: Record<string, unknown>) => {
    Object.assign(store, obj)
  })
  vi.stubGlobal('chrome', { storage: { local: { get, set } } })
  return { store, get, set }
}

describe('readBridgeConfig', () => {
  it('usa el token y url guardados', async () => {
    stubStorage({ [STORAGE_KEY_TOKEN]: 'jwt-abc', [STORAGE_KEY_URL]: 'wss://mapi/bridge' })
    const config = await readBridgeConfig()
    expect(config).toEqual({ token: 'jwt-abc', bridgeUrl: 'wss://mapi/bridge' })
  })

  it('cae al default de URL si no hay guardada, y token vacío', async () => {
    stubStorage({})
    const config = await readBridgeConfig()
    expect(config).toEqual({ token: '', bridgeUrl: DEFAULT_BRIDGE_URL })
  })
})

describe('setters', () => {
  it('setBridgeToken guarda en storage', async () => {
    const { store } = stubStorage()
    await setBridgeToken('jwt-nuevo')
    expect(store[STORAGE_KEY_TOKEN]).toBe('jwt-nuevo')
  })

  it('setBridgeUrl guarda en storage', async () => {
    const { store } = stubStorage()
    await setBridgeUrl('ws://localhost:9999/bridge')
    expect(store[STORAGE_KEY_URL]).toBe('ws://localhost:9999/bridge')
  })
})

describe('httpBaseFromBridgeUrl', () => {
  it('ws → http, wss → https, conserva host', () => {
    expect(httpBaseFromBridgeUrl('ws://localhost:4000/bridge')).toBe('http://localhost:4000')
    expect(httpBaseFromBridgeUrl('wss://mapi.kodapp.com.mx/bridge')).toBe(
      'https://mapi.kodapp.com.mx',
    )
  })
})

describe('loginToMapi', () => {
  it('postea a /v1/auth/login y devuelve token + nombre', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'JWT123', user: { fullName: 'Alfredo' } }),
    })) as unknown as typeof fetch

    const session = await loginToMapi('ws://localhost:4000/bridge', 'a@b.com', 'pw', fetchFn)
    expect(session).toEqual({ token: 'JWT123', name: 'Alfredo' })
    const [url, opts] = (fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]
    expect(url).toBe('http://localhost:4000/v1/auth/login')
    expect(opts.method).toBe('POST')
    expect(opts.body).toContain('a@b.com')
  })

  it('usa el email como nombre si el login no trae fullName', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'JWT123' }),
    })) as unknown as typeof fetch
    const session = await loginToMapi('ws://localhost:4000/bridge', 'a@b.com', 'pw', fetchFn)
    expect(session).toEqual({ token: 'JWT123', name: 'a@b.com' })
  })

  it('lanza si el login falla (no-2xx)', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch
    await expect(
      loginToMapi('ws://localhost:4000/bridge', 'a@b.com', 'bad', fetchFn),
    ).rejects.toThrow()
  })
})
