import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_BRIDGE_URL,
  readBridgeConfig,
  setBridgeSecret,
  setBridgeUrl,
  STORAGE_KEY_SECRET,
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
  it('usa el secret y url guardados', async () => {
    stubStorage({ [STORAGE_KEY_SECRET]: 'abc', [STORAGE_KEY_URL]: 'wss://mapi/bridge' })
    const config = await readBridgeConfig()
    expect(config).toEqual({ secret: 'abc', bridgeUrl: 'wss://mapi/bridge' })
  })

  it('cae al default de URL si no hay guardada, y secret vacío', async () => {
    stubStorage({})
    const config = await readBridgeConfig()
    expect(config).toEqual({ secret: '', bridgeUrl: DEFAULT_BRIDGE_URL })
  })
})

describe('setters', () => {
  it('setBridgeSecret guarda en storage', async () => {
    const { store } = stubStorage()
    await setBridgeSecret('nuevo-secret')
    expect(store[STORAGE_KEY_SECRET]).toBe('nuevo-secret')
  })

  it('setBridgeUrl guarda en storage', async () => {
    const { store } = stubStorage()
    await setBridgeUrl('ws://localhost:9999/bridge')
    expect(store[STORAGE_KEY_URL]).toBe('ws://localhost:9999/bridge')
  })
})
