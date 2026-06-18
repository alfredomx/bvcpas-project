import { Logger } from '@nestjs/common'
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets'
import jwt from 'jsonwebtoken'
import type { RawData, WebSocket } from 'ws'
import { AppConfigService } from '@/core/config/config.service'
import { BridgeCommandService } from './bridge-command.service'
import type { BridgeTransport } from './bridge.internal-types'

/**
 * Gateway WebSocket del bridge (ruta `/bridge`, vía `@nestjs/platform-ws`).
 *
 * Protocolo:
 *  - plugin→mapi `{ type:'hello', token }`  → verifica JWT; si OK registra presencia.
 *  - plugin→mapi `{ type:'result', correlationId, payload }` → lo enruta al command service.
 *  - mapi→plugin comandos correlacionados → los manda el command service.
 *
 * Auth slim (mapi_v2): el `hello` trae el JWT del operador (mismo del login HTTP);
 * se verifica contra `JWT_SECRET` (como el `AdminGuard`, sin sesiones). Hasta que
 * no llega un `hello` válido el socket NO se registra y cualquier otro mensaje lo cierra.
 *
 * Requiere `app.useWebSocketAdapter(new WsAdapter(app))` en el bootstrap.
 */
@WebSocketGateway({ path: '/bridge' })
export class BridgeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BridgeGateway.name)
  private readonly transports = new WeakMap<WebSocket, BridgeTransport>()

  constructor(
    private readonly commands: BridgeCommandService,
    private readonly cfg: AppConfigService,
  ) {}

  handleConnection(client: WebSocket): void {
    let authenticated = false
    const transport: BridgeTransport = { send: (data: string) => client.send(data) }
    this.transports.set(client, transport)

    client.on('message', (raw: RawData) => {
      const msg = parseIncoming(raw)
      if (!msg) return

      if (msg.type === 'hello') {
        if (!this.verifyToken(msg.token)) {
          this.logger.warn('hello con JWT inválido — cerrando socket')
          client.close(4001, 'invalid token')
          return
        }
        authenticated = true
        this.commands.setConnection(transport)
        this.logger.log('plugin (kiro) conectado y autenticado')
        return
      }

      if (!authenticated) {
        this.logger.warn('mensaje antes de autenticar — cerrando socket')
        client.close(4002, 'not authenticated')
        return
      }

      if (msg.type === 'result') {
        this.commands.resolveResult(msg.correlationId, msg.payload)
      }
    })

    client.on('close', () => this.commands.clearConnection(transport))
  }

  handleDisconnect(client: WebSocket): void {
    const transport = this.transports.get(client)
    if (transport) {
      this.commands.clearConnection(transport)
      this.transports.delete(client)
    }
  }

  private verifyToken(token: string): boolean {
    try {
      jwt.verify(token, this.cfg.jwtSecret)
      return true
    } catch {
      return false
    }
  }
}

type IncomingMessage =
  | { type: 'hello'; token: string }
  | { type: 'result'; correlationId: string; payload: unknown }

function rawToString(raw: RawData): string {
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8')
  if (Buffer.isBuffer(raw)) return raw.toString('utf8')
  return Buffer.from(raw).toString('utf8')
}

/** Parsea un frame crudo a un mensaje conocido; null si inválido (se ignora). */
function parseIncoming(raw: RawData): IncomingMessage | null {
  let obj: unknown
  try {
    obj = JSON.parse(rawToString(raw))
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null

  const msg = obj as Record<string, unknown>
  if (msg.type === 'hello' && typeof msg.token === 'string') {
    return { type: 'hello', token: msg.token }
  }
  if (msg.type === 'result' && typeof msg.correlationId === 'string') {
    return { type: 'result', correlationId: msg.correlationId, payload: msg.payload }
  }
  return null
}
