import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { BridgeCommand, BridgeCommandPort } from '@/contracts/bridge.port'
import { BridgeCommandTimeoutError, BridgeNotConnectedError } from './bridge.errors'
import type { BridgeTransport, OutgoingCommandMessage } from './bridge.internal-types'

/** Timeout de un comando al plugin (kiro). Bancos pueden tardar; 30s holgado. */
const COMMAND_TIMEOUT_MS = 30_000

interface PendingCommand {
  resolve: (payload: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Despacha comandos al plugin (kiro) y correlaciona la respuesta. Implementa el
 * `BridgeCommandPort` del core. No conoce WebSocket: habla con un
 * `BridgeTransport` (testeable con un fake). El gateway registra/limpia el
 * transporte (`setConnection`/`clearConnection`) y enruta los `result` entrantes
 * a `resolveResult`.
 *
 * Presencia: una conexión de plugin a la vez (la última gana). Multi-plugin se difiere.
 */
@Injectable()
export class BridgeCommandService implements BridgeCommandPort {
  /** Generador de correlationId. Inyectable para tests. */
  genCorrelationId: () => string = () => randomUUID()

  private transport: BridgeTransport | null = null
  private readonly pending = new Map<string, PendingCommand>()
  private readonly timeoutMs = COMMAND_TIMEOUT_MS

  isPluginConnected(): boolean {
    return this.transport !== null
  }

  setConnection(transport: BridgeTransport): void {
    this.transport = transport
  }

  /** Solo limpia si el transporte que se va es el activo (no pisa una reconexión más nueva). */
  clearConnection(transport: BridgeTransport): void {
    if (this.transport === transport) this.transport = null
  }

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

  /** Resuelve la promesa pendiente para `correlationId` (ignora ids huérfanos/tardíos). */
  resolveResult(correlationId: string, payload: unknown): void {
    const pending = this.pending.get(correlationId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(correlationId)
    pending.resolve(payload)
  }
}
