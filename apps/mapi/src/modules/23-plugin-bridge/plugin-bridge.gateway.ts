import { Logger } from '@nestjs/common'
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { RawData, WebSocket } from 'ws'
import { JwtService } from '../../core/auth/jwt.service'
import { SessionsService } from '../../core/auth/sessions.service'
import { BridgeCommandService } from './bridge-command.service'
import type { BridgeTransport } from './bridge.types'

/**
 * Gateway WebSocket del bridge (ruta `/bridge`, vía `@nestjs/platform-ws`).
 *
 * Protocolo (ver README del módulo):
 *  - plugin→mapi `{ type:'hello', token, clientInfo }`  → valida JWT + sesión; si OK registra presencia.
 *  - plugin→mapi `{ type:'result', correlationId, payload }` → enruta a BridgeCommandService.
 *  - mapi→plugin `{ type:'execute_fetch'|'check_session'|'list_tabs', correlationId, payload? }` → lo manda el service.
 *
 * No usa `@SubscribeMessage` porque el protocolo enruta por `type` (no por el
 * `{event,data}` de platform-ws): se escucha el socket crudo en `handleConnection`.
 *
 * Auth (v0.19.0): el `hello` trae un JWT del operador (mismo del login HTTP). El
 * gateway lo verifica con `JwtService` + `SessionsService` (igual que el
 * `JwtAuthGuard`, pero en el handler WS). Hasta que no llega un `hello` válido el
 * socket NO se registra como presencia y cualquier otro mensaje lo cierra.
 */
@WebSocketGateway({ path: '/bridge' })
export class PluginBridgeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PluginBridgeGateway.name)
  /** Transporte asociado a cada socket (para limpiar presencia al cerrar). */
  private readonly transports = new WeakMap<WebSocket, BridgeTransport>()

  constructor(
    private readonly commands: BridgeCommandService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
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
        void this.authenticate(msg.token).then((ok) => {
          if (!ok) {
            this.logger.warn('hello con JWT inválido — cerrando socket')
            client.close(4001, 'invalid token')
            return
          }
          authenticated = true
          this.commands.setConnection(transport)
          this.logger.log('plugin conectado y autenticado')
        })
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

  /** Verifica el JWT y su sesión (igual que JwtAuthGuard). true si válido. */
  private async authenticate(token: string): Promise<boolean> {
    try {
      const payload = this.jwt.verify(token)
      await this.sessions.verify(payload.jti)
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

/**
 * Parsea un frame crudo del WebSocket a un mensaje conocido. Devuelve null si
 * es inválido o de un tipo no manejado (se ignora sin romper el socket).
 */
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
