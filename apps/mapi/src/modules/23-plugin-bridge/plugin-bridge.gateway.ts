import { Logger } from '@nestjs/common'
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { RawData, WebSocket } from 'ws'
import { AppConfigService } from '../../core/config/config.service'
import { BridgeCommandService } from './bridge-command.service'
import type { BridgeTransport } from './bridge.types'

/**
 * Gateway WebSocket del bridge (ruta `/bridge`, vía `@nestjs/platform-ws`).
 *
 * Protocolo (ver README del módulo):
 *  - plugin→mapi `{ type:'hello', secret, clientInfo }`  → valida secret; si OK registra presencia.
 *  - plugin→mapi `{ type:'result', correlationId, payload }` → enruta a BridgeCommandService.
 *  - mapi→plugin `{ type:'execute_fetch'|'check_session', correlationId, payload }` → lo manda el service.
 *
 * No usa `@SubscribeMessage` porque el protocolo enruta por `type` (no por el
 * `{event,data}` de platform-ws): se escucha el socket crudo en `handleConnection`.
 *
 * Auth: hasta que no llega un `hello` con el `BRIDGE_SECRET` correcto, el socket
 * NO se registra como presencia y cualquier otro mensaje cierra la conexión.
 */
@WebSocketGateway({ path: '/bridge' })
export class PluginBridgeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PluginBridgeGateway.name)
  /** Transporte asociado a cada socket (para limpiar presencia al cerrar). */
  private readonly transports = new WeakMap<WebSocket, BridgeTransport>()

  constructor(
    private readonly commands: BridgeCommandService,
    private readonly config: AppConfigService,
  ) {}

  handleConnection(client: WebSocket): void {
    let authenticated = false
    const transport: BridgeTransport = {
      send: (data: string) => client.send(data),
    }
    this.transports.set(client, transport)

    client.on('message', (raw: RawData) => {
      const msg = parseIncoming(raw)
      if (!msg) return

      if (msg.type === 'hello') {
        if (msg.secret !== this.config.bridgeSecret) {
          this.logger.warn('hello con secret inválido — cerrando socket')
          client.close(4001, 'invalid secret')
          return
        }
        authenticated = true
        this.commands.setConnection(transport)
        this.logger.log('plugin conectado y autenticado')
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

    client.on('close', () => {
      this.commands.clearConnection(transport)
    })
  }

  handleDisconnect(client: WebSocket): void {
    const transport = this.transports.get(client)
    if (transport) {
      this.commands.clearConnection(transport)
      this.transports.delete(client)
    }
  }
}

type IncomingMessage =
  | { type: 'hello'; secret: string }
  | { type: 'result'; correlationId: string; payload: unknown }

/**
 * Parsea un frame crudo del WebSocket a un mensaje conocido. Devuelve null si
 * es inválido o de un tipo no manejado (se ignora sin romper el socket).
 */
function rawToString(raw: RawData): string {
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8')
  if (Buffer.isBuffer(raw)) return raw.toString('utf8')
  return Buffer.from(raw).toString('utf8')
}

function parseIncoming(raw: RawData): IncomingMessage | null {
  let obj: unknown
  try {
    obj = JSON.parse(rawToString(raw))
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null

  const msg = obj as Record<string, unknown>
  if (msg.type === 'hello' && typeof msg.secret === 'string') {
    return { type: 'hello', secret: msg.secret }
  }
  if (msg.type === 'result' && typeof msg.correlationId === 'string') {
    return { type: 'result', correlationId: msg.correlationId, payload: msg.payload }
  }
  return null
}
