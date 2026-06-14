import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'
import { config as dotenvConfig } from 'dotenv'
import WebSocket from 'ws'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { AppConfigModule } from '../../src/core/config/config.module'
import { PluginBridgeModule } from '../../src/modules/23-plugin-bridge/plugin-bridge.module'
import { BridgeCommandService } from '../../src/modules/23-plugin-bridge/bridge-command.service'
import { BridgeNotConnectedError } from '../../src/modules/23-plugin-bridge/bridge.errors'

/**
 * Tests Tipo B (smoke) del bridge WS: cliente `ws` real contra el gateway.
 *
 * - CR-bridge-B01: round-trip — hello (auth) → mapi manda execute_fetch → cliente
 *   responde result → BridgeCommandService.send() resuelve correlacionado.
 * - CR-bridge-B02: hello con secret inválido → el gateway cierra el socket y
 *   no registra presencia.
 * - CR-bridge-B03: sin plugin conectado → send() lanza BridgeNotConnectedError.
 */

dotenvConfig({ path: '.env.test' })

let app: INestApplication
let commands: BridgeCommandService
let baseWsUrl: string
const SECRET = process.env.BRIDGE_SECRET ?? ''

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout')
    await new Promise((r) => setTimeout(r, 10))
  }
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppConfigModule, PluginBridgeModule],
  }).compile()

  app = moduleRef.createNestApplication()
  app.useWebSocketAdapter(new WsAdapter(app))
  await app.listen(0)

  commands = app.get(BridgeCommandService)
  const addr = app.getHttpServer().address() as AddressInfo
  baseWsUrl = `ws://127.0.0.1:${addr.port}/bridge`
})

afterAll(async () => {
  await app.close()
})

describe('PluginBridge (e2e, ws real)', () => {
  it('CR-bridge-B01: round-trip execute_fetch hello→comando→result', async () => {
    const client = new WebSocket(baseWsUrl)
    await once(client, 'open')

    // El plugin de prueba responde cualquier execute_fetch con un resultado fijo.
    client.on('message', (raw: WebSocket.RawData) => {
      const text = Buffer.isBuffer(raw)
        ? raw.toString('utf8')
        : Buffer.from(raw as ArrayBuffer).toString('utf8')
      const msg = JSON.parse(text) as {
        type: string
        correlationId: string
      }
      if (msg.type === 'execute_fetch') {
        client.send(
          JSON.stringify({
            type: 'result',
            correlationId: msg.correlationId,
            payload: { status: 200, bodyText: 'pong' },
          }),
        )
      }
    })

    client.send(JSON.stringify({ type: 'hello', secret: SECRET }))
    await waitFor(() => commands.isPluginConnected())

    const result = await commands.send({
      type: 'execute_fetch',
      payload: { method: 'GET', url: 'https://example.com/api' },
    })
    expect(result).toEqual({ status: 200, bodyText: 'pong' })

    client.close()
    await waitFor(() => !commands.isPluginConnected())
  })

  it('CR-bridge-B02: hello con secret inválido cierra el socket sin registrar presencia', async () => {
    const client = new WebSocket(baseWsUrl)
    await once(client, 'open')

    client.send(JSON.stringify({ type: 'hello', secret: 'secreto-incorrecto' }))
    await once(client, 'close')

    expect(commands.isPluginConnected()).toBe(false)
  })

  it('CR-bridge-B03: send() sin plugin conectado lanza BridgeNotConnectedError', async () => {
    expect(commands.isPluginConnected()).toBe(false)
    await expect(
      commands.send({ type: 'check_session', payload: { bank: 'chase' } }),
    ).rejects.toBeInstanceOf(BridgeNotConnectedError)
  })
})
