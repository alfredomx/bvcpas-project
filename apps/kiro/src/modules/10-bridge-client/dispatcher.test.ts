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

describe('dispatchCommand — list_tabs (corre en el SW)', () => {
  it('devuelve la lista cruda de pestañas (solo las que tienen id)', async () => {
    const query = vi.fn(async () => [
      { id: 7, url: 'https://secure.chase.com/', title: 'Chase', active: true, windowId: 1 },
      { id: undefined, url: 'chrome://newtab', title: 'New', active: false, windowId: 1 },
      { id: 9, url: 'https://otra.com/', title: 'Otra', active: false, windowId: 2 },
    ])
    vi.stubGlobal('chrome', { tabs: { query } })

    const result = (await dispatchCommand({ type: 'list_tabs', correlationId: 'c6' })) as {
      tabs: { tabId: number; url?: string }[]
    }

    expect(query).toHaveBeenCalledTimes(1)
    expect(result.tabs).toEqual([
      { tabId: 7, url: 'https://secure.chase.com/', title: 'Chase', active: true, windowId: 1 },
      { tabId: 9, url: 'https://otra.com/', title: 'Otra', active: false, windowId: 2 },
    ])
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

describe('dispatchCommand — execute_dom (rutea por tabId al content script)', () => {
  it('rutea la receta a la pestaña indicada y devuelve su DomResult', async () => {
    const domResult = { requestId: 'd1', ok: true, results: [{ op: 'fill', ok: true }] }
    const sendMessage = vi.fn(async () => domResult)
    vi.stubGlobal('chrome', { tabs: { sendMessage } })

    const result = await dispatchCommand({
      type: 'execute_dom',
      correlationId: 'd1',
      payload: { tabId: 42, steps: [{ op: 'fill', selector: '#u', value: 'x' }] },
    })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(42, {
      kind: 'kiro:execute_dom',
      correlationId: 'd1',
      payload: { tabId: 42, steps: [{ op: 'fill', selector: '#u', value: 'x' }] },
    })
    expect(result).toEqual(domResult)
  })

  it('devuelve error (sin lanzar) si el content script no responde', async () => {
    const sendMessage = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', { tabs: { sendMessage } })

    const result = await dispatchCommand({
      type: 'execute_dom',
      correlationId: 'd2',
      payload: { tabId: 9, steps: [] },
    })

    expect(result).toEqual({ error: expect.stringContaining('no respondió') })
  })

  it('captura si sendMessage lanza y devuelve { error }', async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error('tab cerrada')
    })
    vi.stubGlobal('chrome', { tabs: { sendMessage } })

    const result = await dispatchCommand({
      type: 'execute_dom',
      correlationId: 'd3',
      payload: { tabId: 9, steps: [{ op: 'click', selector: '#b' }] },
    })

    expect(result).toEqual({ error: 'tab cerrada' })
  })
})

describe('dispatchCommand — open_tab (corre en el SW)', () => {
  const URL = 'https://secure.chase.com/web/auth/#/logon/logon/chaseOnline'

  it('crea la pestaña y espera el load (onUpdated complete) antes de responder', async () => {
    const create = vi.fn(async () => ({ id: 99, status: 'loading' }))
    const addListener = vi.fn()
    const removeListener = vi.fn()
    vi.stubGlobal('chrome', { tabs: { create, onUpdated: { addListener, removeListener } } })

    const p = dispatchCommand({ type: 'open_tab', correlationId: 'o1', payload: { url: URL } })

    // Espera a que openTab registre el listener tras el create async.
    await vi.waitFor(() => expect(addListener).toHaveBeenCalledTimes(1))
    const listener = addListener.mock.calls[0][0] as (id: number, info: { status?: string }) => void

    // Eventos que NO deben resolver: otra pestaña, o status distinto de complete.
    listener(7, { status: 'complete' })
    listener(99, { status: 'loading' })
    // El que sí resuelve:
    listener(99, { status: 'complete' })

    const result = await p
    expect(create).toHaveBeenCalledWith({ url: URL, active: true })
    expect(result).toEqual({ tabId: 99, url: URL })
    expect(removeListener).toHaveBeenCalledTimes(1)
  })

  it('si la pestaña ya viene complete, no espera onUpdated', async () => {
    const create = vi.fn(async () => ({ id: 50, status: 'complete' }))
    const addListener = vi.fn()
    vi.stubGlobal('chrome', {
      tabs: { create, onUpdated: { addListener, removeListener: vi.fn() } },
    })

    const result = await dispatchCommand({
      type: 'open_tab',
      correlationId: 'o2',
      payload: { url: 'https://x.com/' },
    })

    expect(result).toEqual({ tabId: 50, url: 'https://x.com/' })
    expect(addListener).not.toHaveBeenCalled()
  })

  it('devuelve error (sin lanzar) si chrome no devuelve tabId', async () => {
    const create = vi.fn(async () => ({ id: undefined, status: 'loading' }))
    vi.stubGlobal('chrome', {
      tabs: { create, onUpdated: { addListener: vi.fn(), removeListener: vi.fn() } },
    })

    const result = await dispatchCommand({
      type: 'open_tab',
      correlationId: 'o3',
      payload: { url: 'https://x.com/' },
    })

    expect(result).toEqual({ error: expect.stringContaining('tabId') })
  })
})
