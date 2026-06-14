import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'
import { config as dotenvConfig } from 'dotenv'
import request from 'supertest'
import WebSocket from 'ws'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { AppModule } from '../../src/app.module'
import { BridgeCommandService } from '../../src/modules/23-plugin-bridge/bridge-command.service'
import { BridgeNotConnectedError } from '../../src/modules/23-plugin-bridge/bridge.errors'
import { truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (smoke) del bridge WS con auth JWT (v0.19.0). Cliente `ws` real
 * contra el gateway. Se loguea un admin real (seed + /v1/auth/login) para
 * obtener un JWT con sesión válida.
 *
 * - CR-bridge-B01: hello con JWT válido → mapi manda execute_fetch → cliente
 *   responde result → BridgeCommandService.send() resuelve correlacionado.
 * - CR-bridge-B02: hello con JWT inválido → el gateway cierra el socket.
 * - CR-bridge-B03: sin plugin conectado → send() lanza BridgeNotConnectedError.
 * - CR-bridge-B04: list_tabs round-trip (el plugin devuelve la lista de tabs).
 */

dotenvConfig({ path: '.env.test' })

const ADMIN_EMAIL = 'bridge-admin@example.com'
const ADMIN_PASSWORD = 'Bridge-Admin-123'
const ADMINISTRATOR_ROLE_ID = '00000000-0000-0000-0000-000000000001'

let app: INestApplication
let commands: BridgeCommandService
let baseWsUrl: string
let token: string

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout')
    await new Promise((r) => setTimeout(r, 10))
  }
}

async function seedAdminAndLogin(): Promise<string> {
  const { default: postgres } = await import('postgres')
  const { hash } = await import('bcrypt')
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL requerido')
  const client = postgres(databaseUrl, { max: 1 })
  try {
    const hashed = await hash(ADMIN_PASSWORD, 4)
    const [inserted] = await client<{ id: string }[]>`
      INSERT INTO users (email, password_hash, full_name, status)
      VALUES (${ADMIN_EMAIL}, ${hashed}, 'Bridge Admin', 'active')
      RETURNING id
    `
    await client`
      INSERT INTO user_roles (user_id, role_id) VALUES (${inserted.id}, ${ADMINISTRATOR_ROLE_ID})
    `
  } finally {
    await client.end()
  }
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    .expect(200)
  return (res.body as { accessToken: string }).accessToken
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = moduleRef.createNestApplication()
  app.useWebSocketAdapter(new WsAdapter(app))
  app.setGlobalPrefix('v1', { exclude: ['metrics'] })
  await app.listen(0)

  await truncateTables()
  token = await seedAdminAndLogin()

  commands = app.get(BridgeCommandService)
  const addr = app.getHttpServer().address() as AddressInfo
  baseWsUrl = `ws://127.0.0.1:${addr.port}/bridge`
}, 30000)

afterAll(async () => {
  await app.close()
})

describe('PluginBridge (e2e, ws real, JWT)', () => {
  it('CR-bridge-B01: round-trip execute_fetch con hello JWT válido', async () => {
    const client = new WebSocket(baseWsUrl)
    await once(client, 'open')

    client.on('message', (raw: WebSocket.RawData) => {
      const text = Buffer.isBuffer(raw)
        ? raw.toString('utf8')
        : Buffer.from(raw as ArrayBuffer).toString('utf8')
      const msg = JSON.parse(text) as { type: string; correlationId: string }
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

    client.send(JSON.stringify({ type: 'hello', token }))
    await waitFor(() => commands.isPluginConnected())

    const result = await commands.send({
      type: 'execute_fetch',
      payload: { method: 'GET', url: 'https://example.com/api' },
    })
    expect(result).toEqual({ status: 200, bodyText: 'pong' })

    client.close()
    await waitFor(() => !commands.isPluginConnected())
  })

  it('CR-bridge-B04: list_tabs round-trip devuelve la lista de pestañas', async () => {
    const client = new WebSocket(baseWsUrl)
    await once(client, 'open')

    client.on('message', (raw: WebSocket.RawData) => {
      const text = Buffer.isBuffer(raw)
        ? raw.toString('utf8')
        : Buffer.from(raw as ArrayBuffer).toString('utf8')
      const msg = JSON.parse(text) as { type: string; correlationId: string }
      if (msg.type === 'list_tabs') {
        client.send(
          JSON.stringify({
            type: 'result',
            correlationId: msg.correlationId,
            payload: {
              tabs: [{ tabId: 7, url: 'https://secure.chase.com/', active: true, windowId: 1 }],
            },
          }),
        )
      }
    })

    client.send(JSON.stringify({ type: 'hello', token }))
    await waitFor(() => commands.isPluginConnected())

    const result = (await commands.send({ type: 'list_tabs' })) as {
      tabs: { tabId: number; url?: string }[]
    }
    expect(result.tabs).toHaveLength(1)
    expect(result.tabs[0]).toMatchObject({ tabId: 7, url: 'https://secure.chase.com/' })

    client.close()
    await waitFor(() => !commands.isPluginConnected())
  })

  it('CR-bridge-B02: hello con JWT inválido cierra el socket sin registrar presencia', async () => {
    const client = new WebSocket(baseWsUrl)
    await once(client, 'open')
    client.send(JSON.stringify({ type: 'hello', token: 'no-es-un-jwt-valido' }))
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
