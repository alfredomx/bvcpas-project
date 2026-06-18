import { BridgeCommandService } from '@plugins/kiro-bridge/src/bridge-command.service'
import {
  BridgeCommandTimeoutError,
  BridgeNotConnectedError,
} from '@plugins/kiro-bridge/src/bridge.errors'
import type { BridgeTransport } from '@plugins/kiro-bridge/src/bridge.internal-types'

function svc(): BridgeCommandService {
  const s = new BridgeCommandService()
  s.genCorrelationId = () => 'cid-1'
  return s
}

function fakeTransport(): { transport: BridgeTransport; sent: string[] } {
  const sent: string[] = []
  return { transport: { send: (d: string) => sent.push(d) }, sent }
}

describe('BridgeCommandService', () => {
  it('send sin plugin conectado → NOT_CONNECTED', async () => {
    await expect(svc().send({ type: 'list_tabs' })).rejects.toBeInstanceOf(
      BridgeNotConnectedError,
    )
  })

  it('isPluginConnected refleja set/clear', () => {
    const s = svc()
    const { transport } = fakeTransport()
    expect(s.isPluginConnected()).toBe(false)
    s.setConnection(transport)
    expect(s.isPluginConnected()).toBe(true)
    s.clearConnection(transport)
    expect(s.isPluginConnected()).toBe(false)
  })

  it('send despacha el comando correlacionado y resuelve con el result', async () => {
    const s = svc()
    const { transport, sent } = fakeTransport()
    s.setConnection(transport)
    const p = s.send({ type: 'execute_fetch', payload: { method: 'GET', url: 'https://x' } })
    expect(JSON.parse(sent[0]!)).toEqual({
      type: 'execute_fetch',
      correlationId: 'cid-1',
      payload: { method: 'GET', url: 'https://x' },
    })
    s.resolveResult('cid-1', { ok: true, status: 200 })
    await expect(p).resolves.toEqual({ ok: true, status: 200 })
  })

  it('send hace timeout si el plugin no responde', async () => {
    jest.useFakeTimers()
    const s = svc()
    const { transport } = fakeTransport()
    s.setConnection(transport)
    const p = s.send({ type: 'list_tabs' })
    const assertion = expect(p).rejects.toBeInstanceOf(BridgeCommandTimeoutError)
    jest.advanceTimersByTime(30_000)
    await assertion
    jest.useRealTimers()
  })

  it('clearConnection no pisa una reconexión más nueva', () => {
    const s = svc()
    const a = fakeTransport().transport
    const b = fakeTransport().transport
    s.setConnection(a)
    s.setConnection(b)
    s.clearConnection(a)
    expect(s.isPluginConnected()).toBe(true)
  })

  it('resolveResult con id huérfano se ignora', () => {
    const s = svc()
    expect(() => s.resolveResult('nope', {})).not.toThrow()
  })
})
