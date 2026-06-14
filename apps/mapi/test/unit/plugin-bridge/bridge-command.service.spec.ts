import { BridgeCommandService } from '../../../src/modules/23-plugin-bridge/bridge-command.service'
import type { BridgeTransport } from '../../../src/modules/23-plugin-bridge/bridge.types'
import {
  BridgeCommandTimeoutError,
  BridgeNotConnectedError,
} from '../../../src/modules/23-plugin-bridge/bridge.errors'
import type { AppConfigService } from '../../../src/core/config/config.service'

/**
 * Tests Tipo A para BridgeCommandService (correlación + timeout + presencia),
 * con un transporte (socket) mockeado. Sin WS real, sin DB.
 *
 * Cobertura:
 * - CR-bridge-001: send() sin plugin conectado → BridgeNotConnectedError.
 * - CR-bridge-002: send() conectado → escribe { type, correlationId, payload } al socket.
 * - CR-bridge-003: resolveResult(correlationId) resuelve la promesa con el payload.
 * - CR-bridge-004: sin respuesta → timeout → BridgeCommandTimeoutError.
 * - CR-bridge-005: resolveResult con correlationId desconocido → no-op (no rompe).
 * - CR-bridge-006: clearConnection limpia presencia (isPluginConnected=false, send vuelve a lanzar).
 * - CR-bridge-007: check_session manda el shape correcto.
 */

const TIMEOUT_MS = 1000

function makeConfig(): AppConfigService {
  return { bridgeCommandTimeoutMs: TIMEOUT_MS } as unknown as AppConfigService
}

function makeTransport(): jest.Mocked<BridgeTransport> {
  return { send: jest.fn() }
}

function buildService(): BridgeCommandService {
  const svc = new BridgeCommandService(makeConfig())
  // correlationId determinista para asserts.
  let n = 0
  svc.genCorrelationId = () => `corr-${++n}`
  return svc
}

describe('BridgeCommandService', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('CR-bridge-001: send() sin plugin conectado lanza BridgeNotConnectedError', async () => {
    const svc = buildService()
    expect(svc.isPluginConnected()).toBe(false)
    await expect(
      svc.send({ type: 'execute_fetch', payload: { method: 'GET', url: 'https://x/api' } }),
    ).rejects.toBeInstanceOf(BridgeNotConnectedError)
  })

  it('CR-bridge-002: send() conectado escribe el comando correlacionado al socket', () => {
    const svc = buildService()
    const transport = makeTransport()
    svc.setConnection(transport)

    void svc.send({
      type: 'execute_fetch',
      payload: { method: 'POST', url: 'https://bank/api', headers: { a: 'b' }, body: 'x' },
    })

    expect(transport.send).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(transport.send.mock.calls[0][0])
    expect(sent).toEqual({
      type: 'execute_fetch',
      correlationId: 'corr-1',
      payload: { method: 'POST', url: 'https://bank/api', headers: { a: 'b' }, body: 'x' },
    })
  })

  it('CR-bridge-003: resolveResult resuelve la promesa con el payload del plugin', async () => {
    const svc = buildService()
    svc.setConnection(makeTransport())

    const promise = svc.send({
      type: 'execute_fetch',
      payload: { method: 'GET', url: 'https://bank/api' },
    })

    svc.resolveResult('corr-1', { status: 200, bodyText: 'ok' })

    await expect(promise).resolves.toEqual({ status: 200, bodyText: 'ok' })
  })

  it('CR-bridge-004: sin respuesta el comando hace timeout con BridgeCommandTimeoutError', async () => {
    const svc = buildService()
    svc.setConnection(makeTransport())

    const promise = svc.send({
      type: 'execute_fetch',
      payload: { method: 'GET', url: 'https://bank/api' },
    })
    // Evita unhandled rejection antes de avanzar el timer.
    const assertion = expect(promise).rejects.toBeInstanceOf(BridgeCommandTimeoutError)

    jest.advanceTimersByTime(TIMEOUT_MS)
    await assertion
  })

  it('CR-bridge-005: resolveResult con correlationId desconocido no rompe', () => {
    const svc = buildService()
    svc.setConnection(makeTransport())
    expect(() => svc.resolveResult('no-existe', { any: true })).not.toThrow()
  })

  it('CR-bridge-006: clearConnection limpia presencia y send vuelve a lanzar', async () => {
    const svc = buildService()
    const transport = makeTransport()
    svc.setConnection(transport)
    expect(svc.isPluginConnected()).toBe(true)

    svc.clearConnection(transport)
    expect(svc.isPluginConnected()).toBe(false)

    await expect(
      svc.send({ type: 'check_session', payload: { bank: 'chase' } }),
    ).rejects.toBeInstanceOf(BridgeNotConnectedError)
  })

  it('CR-bridge-007: check_session manda el shape correcto', () => {
    const svc = buildService()
    const transport = makeTransport()
    svc.setConnection(transport)

    void svc.send({ type: 'check_session', payload: { bank: 'chase' } })

    const sent = JSON.parse(transport.send.mock.calls[0][0])
    expect(sent).toEqual({
      type: 'check_session',
      correlationId: 'corr-1',
      payload: { bank: 'chase' },
    })
  })

  it('CR-bridge-008: una respuesta correlacionada cancela el timeout (no rejeta después)', async () => {
    const svc = buildService()
    svc.setConnection(makeTransport())

    const promise = svc.send({
      type: 'execute_fetch',
      payload: { method: 'GET', url: 'https://bank/api' },
    })
    svc.resolveResult('corr-1', { ok: true })
    await expect(promise).resolves.toEqual({ ok: true })

    // Avanzar el reloj más allá del timeout no debe producir efectos.
    expect(() => jest.advanceTimersByTime(TIMEOUT_MS * 2)).not.toThrow()
  })

  it('CR-bridge-009: send(list_tabs) manda el comando sin payload y resuelve con la lista', async () => {
    const svc = buildService()
    const transport = makeTransport()
    svc.setConnection(transport)

    const promise = svc.send({ type: 'list_tabs' })
    const sent = JSON.parse(transport.send.mock.calls[0][0]) as {
      type: string
      correlationId: string
      payload?: unknown
    }
    expect(sent.type).toBe('list_tabs')
    expect(sent.correlationId).toBe('corr-1')
    expect(sent.payload).toBeUndefined()

    svc.resolveResult('corr-1', { tabs: [{ tabId: 7, active: true, windowId: 1 }] })
    await expect(promise).resolves.toEqual({ tabs: [{ tabId: 7, active: true, windowId: 1 }] })
  })
})
