import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AppConfigService } from '../../core/config/config.service'
import { BridgeCommandTimeoutError, BridgeNotConnectedError } from './bridge.errors'
import type { BridgeCommand, BridgeTransport, OutgoingCommandMessage } from './bridge.types'

interface PendingCommand {
  resolve: (payload: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Despacha comandos al plugin (kiro) y correlaciona la respuesta.
 *
 * El gateway (`PluginBridgeGateway`) registra/limpia el transporte cuando un
 * plugin se conecta/desconecta (`setConnection`/`clearConnection`) y enruta los
 * `result` entrantes a `resolveResult`. Este service no conoce WebSocket: solo
 * habla con un `BridgeTransport` (testeable con un fake).
 *
 * Correlación: cada `send` genera un `correlationId`, registra una promesa
 * pendiente y arranca un timer. Si llega `result` con ese id → resuelve; si
 * vence el timer → rechaza con `BridgeCommandTimeoutError`.
 *
 * Presencia (v0.17.0): una sola conexión de plugin a la vez (la última gana).
 * Multi-plugin se difiere.
 */
@Injectable()
export class BridgeCommandService {
  /** Generador de correlationId. Inyectable para tests. */
  genCorrelationId: () => string = () => randomUUID()

  private transport: BridgeTransport | null = null
  private readonly pending = new Map<string, PendingCommand>()
  private readonly timeoutMs: number

  constructor(config: AppConfigService) {
    this.timeoutMs = config.bridgeCommandTimeoutMs
  }

  /** ¿Hay un plugin conectado ahora mismo? */
  isPluginConnected(): boolean {
    return this.transport !== null
  }

  /** El gateway registra el transporte del plugin recién conectado/autenticado. */
  setConnection(transport: BridgeTransport): void {
    this.transport = transport
  }

  /**
   * El gateway limpia la presencia al cerrarse el socket. Solo limpia si el
   * transporte que se va es el activo (evita borrar una reconexión más nueva).
   * Las promesas pendientes siguen su curso y harán timeout.
   */
  clearConnection(transport: BridgeTransport): void {
    if (this.transport === transport) this.transport = null
  }

  /**
   * Manda un comando al plugin y resuelve con su `result.payload`.
   * @throws BridgeNotConnectedError si no hay plugin conectado.
   * @throws BridgeCommandTimeoutError si el plugin no responde a tiempo.
   */
  send(command: BridgeCommand): Promise<unknown> {
    const transport = this.transport
    if (!transport) return Promise.reject(new BridgeNotConnectedError())

    const correlationId = this.genCorrelationId()
    const message: OutgoingCommandMessage = {
      type: command.type,
      correlationId,
      payload: command.payload,
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId)
        reject(new BridgeCommandTimeoutError(correlationId, this.timeoutMs))
      }, this.timeoutMs)

      this.pending.set(correlationId, { resolve, reject, timer })

      try {
        transport.send(JSON.stringify(message))
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(correlationId)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  /**
   * Resuelve la promesa pendiente para `correlationId` con el payload del
   * plugin. Si el id no existe (resultado huérfano o tardío tras timeout), se
   * ignora sin romper.
   */
  resolveResult(correlationId: string, payload: unknown): void {
    const pending = this.pending.get(correlationId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(correlationId)
    pending.resolve(payload)
  }
}
