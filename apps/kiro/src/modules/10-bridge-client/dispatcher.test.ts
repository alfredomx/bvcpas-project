import { afterEach, describe, expect, it, vi } from 'vitest'

import { dispatchCommand } from './dispatcher'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('dispatchCommand — execute_fetch (rutea al content script)', () => {
  it('encuentra la pestaña same-origin y rutea vía chrome.tabs.sendMessage', async () => {
    const query = vi.fn(async () => [
      { id: 1, url: 'https://otra.com/x' },
      { id: 2, url: 'https://bank.example/login' },
    ])
    const sendMessage = vi.fn(async () => ({
      requestId: 'c1',
      ok: true,
      status: 200,
      headers: {},
      body: 'ok',
      bodyEncoding: 'text',
    }))
    vi.stubGlobal('chrome', { tabs: { query, sendMessage } })

    const result = await dispatchCommand({
      type: 'execute_fetch',
      correlationId: 'c1',
      payload: { method: 'GET', url: 'https://bank.example/api/data' },
    })

    // Ruteó a la pestaña same-origin (id 2), no a la otra.
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(2, {
      kind: 'kiro:execute_fetch',
      correlationId: 'c1',
      payload: { method: 'GET', url: 'https://bank.example/api/data' },
    })
    expect(result).toMatchObject({ requestId: 'c1', ok: true, body: 'ok' })
  })

  it('devuelve error (sin lanzar) si no hay pestaña same-origin', async () => {
    const query = vi.fn(async () => [{ id: 1, url: 'https://otra.com/x' }])
    const sendMessage = vi.fn()
    vi.stubGlobal('chrome', { tabs: { query, sendMessage } })

    const result = await dispatchCommand({
      type: 'execute_fetch',
      correlationId: 'c2',
      payload: { method: 'GET', url: 'https://bank.example/api' },
    })

    expect(sendMessage).not.toHaveBeenCalled()
    expect(result).toEqual({
      error: expect.stringContaining('no hay pestaña same-origin'),
    })
  })

  it('devuelve error si el content script no responde', async () => {
    const query = vi.fn(async () => [{ id: 5, url: 'https://bank.example/' }])
    const sendMessage = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', { tabs: { query, sendMessage } })

    const result = await dispatchCommand({
      type: 'execute_fetch',
      correlationId: 'c3',
      payload: { method: 'GET', url: 'https://bank.example/api' },
    })

    expect(result).toEqual({ error: expect.stringContaining('no respondió') })
  })

  it('devuelve error si sendMessage lanza (pestaña sin content script)', async () => {
    const query = vi.fn(async () => [{ id: 5, url: 'https://bank.example/' }])
    const sendMessage = vi.fn(async () => {
      throw new Error('Could not establish connection')
    })
    vi.stubGlobal('chrome', { tabs: { query, sendMessage } })

    const result = await dispatchCommand({
      type: 'execute_fetch',
      correlationId: 'c4',
      payload: { method: 'GET', url: 'https://bank.example/api' },
    })

    expect(result).toEqual({ error: expect.stringContaining('connection') })
  })
})

describe('dispatchCommand — check_session (corre en el SW)', () => {
  it('llama chrome.tabs.query y devuelve el CheckSessionResult', async () => {
    const query = vi.fn(async () => [{ url: 'https://example.com/dashboard' }])
    vi.stubGlobal('chrome', { tabs: { query } })

    const result = await dispatchCommand({
      type: 'check_session',
      correlationId: 'c5',
      payload: { bank: 'example.com' },
    })

    expect(query).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ bank: 'example.com', authenticated: true, tabCount: 1 })
  })
})
