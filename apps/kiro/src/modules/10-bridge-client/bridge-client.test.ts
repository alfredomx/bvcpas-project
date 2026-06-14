import { afterEach, describe, expect, it, vi } from 'vitest'

import { BridgeClient, parseIncomingCommand } from './bridge-client'
import type { WebSocketLike } from './bridge-client'
import type { BridgeClientConfig, ClientInfo, IncomingCommandMessage } from './types'

// --- Fake WebSocket controlable desde el test ---

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = []
  sent: string[] = []
  closed = false

  onopen: ((this: unknown, ev: unknown) => unknown) | null = null
  onclose: ((this: unknown, ev: unknown) => unknown) | null = null
  onerror: ((this: unknown, ev: unknown) => unknown) | null = null
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.closed = true
  }

  // Helpers para simular eventos del servidor.
  fireOpen(): void {
    this.onopen?.call(this, {})
  }
  fireClose(): void {
    this.onclose?.call(this, {})
  }
  fireError(): void {
    this.onerror?.call(this, {})
  }
  fireMessage(data: unknown): void {
    this.onmessage?.call(this, { data })
  }
}

const CONFIG: BridgeClientConfig = {
  bridgeUrl: 'ws://localhost:4000/bridge',
  secret: 's3cr3t-test',
}
const CLIENT_INFO: ClientInfo = { version: '0.2.0', userAgent: 'test' }

function makeClient(overrides?: {
  dispatch?: (cmd: IncomingCommandMessage) => Promise<unknown>
  scheduleReconnect?: (fn: () => void, ms: number) => void
}) {
  const persistStatus = vi.fn(async () => {})
  const dispatch = overrides?.dispatch
    ? vi.fn(overrides.dispatch)
    : vi.fn(async () => ({
        requestId: 'x',
        ok: true,
        status: 200,
        headers: {},
        body: '',
        bodyEncoding: 'text',
      }))
  const scheduleReconnect = overrides?.scheduleReconnect ?? vi.fn()

  const client = new BridgeClient(CONFIG, {
    WebSocketImpl: FakeWebSocket as unknown as new (url: string) => WebSocketLike,
    clientInfo: CLIENT_INFO,
    dispatch: dispatch as never,
    persistStatus,
    scheduleReconnect,
  })
  return { client, persistStatus, dispatch, scheduleReconnect }
}

afterEach(() => {
  FakeWebSocket.instances = []
  vi.restoreAllMocks()
})

describe('BridgeClient — conexión y hello', () => {
  it('al abrir manda hello con el secret y clientInfo', () => {
    const { client } = makeClient()
    client.connect()

    const ws = FakeWebSocket.instances[0]
    expect(ws.url).toBe(CONFIG.bridgeUrl)
    ws.fireOpen()

    expect(ws.sent).toHaveLength(1)
    const hello = JSON.parse(ws.sent[0])
    expect(hello).toEqual({
      type: 'hello',
      secret: 's3cr3t-test',
      clientInfo: { version: '0.2.0', userAgent: 'test' },
    })
  })

  it('persiste estado conectado tras el hello', () => {
    const { client, persistStatus } = makeClient()
    client.connect()
    FakeWebSocket.instances[0].fireOpen()
    expect(persistStatus).toHaveBeenCalledWith(expect.objectContaining({ connected: true }))
  })
})

describe('BridgeClient — reconnect con backoff', () => {
  it('tras una caída agenda reconexión con backoff', () => {
    const scheduleReconnect = vi.fn()
    const { client } = makeClient({ scheduleReconnect })
    client.connect()
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()
    ws.fireClose()

    expect(scheduleReconnect).toHaveBeenCalledTimes(1)
    // Primer intento: backoff base = 1000ms.
    expect(scheduleReconnect.mock.calls[0][1]).toBe(1000)
  })

  it('el backoff crece exponencial entre caídas consecutivas', () => {
    // scheduleReconnect ejecuta el reconnect inmediatamente para encadenar caídas.
    const scheduleReconnect = vi.fn((fn: () => void, _ms: number) => fn())
    const { client } = makeClient({ scheduleReconnect })
    client.connect()

    // Caída 1 → agenda 1000, reconecta (nueva ws), cae de nuevo, etc.
    FakeWebSocket.instances[0].fireClose() // attempt 0 → 1000ms, attempts=1
    FakeWebSocket.instances[1].fireClose() // attempt 1 → 2000ms, attempts=2
    FakeWebSocket.instances[2].fireClose() // attempt 2 → 4000ms, attempts=3

    const delays = scheduleReconnect.mock.calls.map((c) => c[1])
    expect(delays).toEqual([1000, 2000, 4000])
  })

  it('no reconecta tras disconnect() explícito', () => {
    const scheduleReconnect = vi.fn()
    const { client } = makeClient({ scheduleReconnect })
    client.connect()
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()
    client.disconnect()
    ws.fireClose()
    expect(scheduleReconnect).not.toHaveBeenCalled()
  })

  it('resetea el backoff al reconectar exitosamente', () => {
    const scheduleReconnect = vi.fn((fn: () => void, _ms: number) => fn())
    const { client } = makeClient({ scheduleReconnect })
    client.connect()
    FakeWebSocket.instances[0].fireClose() // 1000ms, attempts=1
    FakeWebSocket.instances[1].fireOpen() // reconectó OK → attempts=0
    FakeWebSocket.instances[1].fireClose() // vuelve a 1000ms

    const delays = scheduleReconnect.mock.calls.map((c) => c[1])
    expect(delays).toEqual([1000, 1000])
  })
})

describe('BridgeClient — dispatch y correlación', () => {
  it('execute_fetch: despacha y responde result con la misma correlationId', async () => {
    const dispatch = vi.fn(async () => ({
      requestId: 'corr-1',
      ok: true,
      status: 200,
      headers: {},
      body: '{"ok":1}',
      bodyEncoding: 'text' as const,
    }))
    const { client } = makeClient({ dispatch })
    client.connect()
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()
    ws.sent.length = 0 // descartamos el hello

    ws.fireMessage(
      JSON.stringify({
        type: 'execute_fetch',
        correlationId: 'corr-1',
        payload: { method: 'GET', url: 'https://bank.example/api' },
      }),
    )
    await vi.waitFor(() => expect(ws.sent).toHaveLength(1))

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'execute_fetch', correlationId: 'corr-1' }),
    )
    const result = JSON.parse(ws.sent[0])
    expect(result.type).toBe('result')
    expect(result.correlationId).toBe('corr-1')
    expect(result.payload.body).toBe('{"ok":1}')
  })

  it('check_session: despacha en el SW y responde result correlacionado', async () => {
    const dispatch = vi.fn(async () => ({ bank: 'example.com', authenticated: true, tabCount: 1 }))
    const { client } = makeClient({ dispatch })
    client.connect()
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()
    ws.sent.length = 0

    ws.fireMessage(
      JSON.stringify({
        type: 'check_session',
        correlationId: 'corr-2',
        payload: { bank: 'example.com' },
      }),
    )
    await vi.waitFor(() => expect(ws.sent).toHaveLength(1))

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'check_session', correlationId: 'corr-2' }),
    )
    const result = JSON.parse(ws.sent[0])
    expect(result.correlationId).toBe('corr-2')
    expect(result.payload).toMatchObject({ bank: 'example.com', authenticated: true })
  })

  it('comando desconocido no rompe el socket ni llama dispatch', async () => {
    const dispatch = vi.fn(async () => ({}))
    const { client } = makeClient({ dispatch })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    client.connect()
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()
    ws.sent.length = 0

    ws.fireMessage(JSON.stringify({ type: 'nope', correlationId: 'x', payload: {} }))
    // No responde, no llama dispatch, no cierra el socket.
    await Promise.resolve()
    expect(dispatch).not.toHaveBeenCalled()
    expect(ws.sent).toHaveLength(0)
    expect(ws.closed).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('JSON inválido no rompe el socket', async () => {
    const dispatch = vi.fn(async () => ({}))
    const { client } = makeClient({ dispatch })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    client.connect()
    const ws = FakeWebSocket.instances[0]
    ws.fireOpen()
    ws.sent.length = 0

    ws.fireMessage('{ esto no es json }')
    await Promise.resolve()
    expect(dispatch).not.toHaveBeenCalled()
    expect(ws.closed).toBe(false)
  })
})

describe('parseIncomingCommand', () => {
  it('parsea execute_fetch válido', () => {
    const cmd = parseIncomingCommand(
      JSON.stringify({
        type: 'execute_fetch',
        correlationId: 'a',
        payload: { method: 'POST', url: 'https://x/y', headers: { A: '1' }, body: 'b' },
      }),
    )
    expect(cmd).toEqual({
      type: 'execute_fetch',
      correlationId: 'a',
      payload: { method: 'POST', url: 'https://x/y', headers: { A: '1' }, body: 'b' },
    })
  })

  it('parsea check_session válido', () => {
    const cmd = parseIncomingCommand({
      type: 'check_session',
      correlationId: 'b',
      payload: { bank: 'example.com' },
    })
    expect(cmd).toEqual({
      type: 'check_session',
      correlationId: 'b',
      payload: { bank: 'example.com' },
    })
  })

  it('rechaza sin correlationId', () => {
    expect(parseIncomingCommand({ type: 'check_session', payload: { bank: 'x' } })).toBeNull()
  })

  it('rechaza execute_fetch sin url/method', () => {
    expect(
      parseIncomingCommand({ type: 'execute_fetch', correlationId: 'a', payload: { url: 'x' } }),
    ).toBeNull()
  })

  it('rechaza tipo desconocido', () => {
    expect(parseIncomingCommand({ type: 'foo', correlationId: 'a', payload: {} })).toBeNull()
  })

  it('rechaza no-objeto', () => {
    expect(parseIncomingCommand(null)).toBeNull()
    expect(parseIncomingCommand(42)).toBeNull()
  })
})
