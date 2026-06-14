// Cliente WebSocket del bridge (corre en el service worker MV3).
//
// Responsabilidades:
//  1. Conectar a `BRIDGE_URL` y al abrir mandar `{ type:'hello', secret, clientInfo }`.
//  2. Recibir comandos (`execute_fetch` / `check_session`), despacharlos
//     (ver dispatcher.ts) y responder `{ type:'result', correlationId, payload }`.
//  3. Reconectar con backoff exponencial tras una caída.
//  4. Keepalive MV3: programar un `chrome.alarms` para revivir el SW dormido y
//     reconectar.
//
// LIMITACIÓN MV3 (riesgo conocido, documentado): el service worker se duerme
// ~30s en idle → el WebSocket se cae cuando el plugin está inactivo. El alarm
// (mín ~30s) revive el SW y `connect()` se vuelve a llamar. En el flujo real el
// usuario está presente (dispara desde Claude/mapi) → SW despierto. Si el SW
// estaba dormido y se perdió el primer comando, mapi reintenta tras el
// re-anuncio (`hello`). Esto requiere verificación EN VIVO con mapi v0.17.0.

import { dispatchCommand } from './dispatcher'
import { writeBridgeStatus } from './config'
import type {
  BridgeClientConfig,
  ClientInfo,
  HelloMessage,
  IncomingCommandMessage,
  ResultMessage,
} from './types'

/** Subconjunto de la API de WebSocket que usamos (para poder inyectar un fake). */
export interface WebSocketLike {
  send(data: string): void
  close(): void
  onopen: ((this: unknown, ev: unknown) => unknown) | null
  onclose: ((this: unknown, ev: unknown) => unknown) | null
  onerror: ((this: unknown, ev: unknown) => unknown) | null
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null
}

/** Constructor de WebSocket inyectable (el global `WebSocket` o un fake en tests). */
export type WebSocketCtor = new (url: string) => WebSocketLike

/** Dependencias inyectables del cliente (todo lo "ambiental" entra por aquí). */
export interface BridgeClientDeps {
  /** Constructor de WebSocket. Default: el global `WebSocket`. */
  WebSocketImpl?: WebSocketCtor
  /** Info del cliente para el `hello`. */
  clientInfo: ClientInfo
  /** Función de dispatch (default: la real). Inyectable para tests. */
  dispatch?: typeof dispatchCommand
  /** Persistencia de estado (default: writeBridgeStatus). Inyectable para tests. */
  persistStatus?: typeof writeBridgeStatus
  /** scheduler de reconnect (default: setTimeout). Inyectable para tests. */
  scheduleReconnect?: (fn: () => void, ms: number) => void
}

/** Nombre del alarm de keepalive MV3. */
export const KEEPALIVE_ALARM = 'kiro-bridge-keepalive'
/** Período del alarm en minutos (mín de Chrome ~0.5 = 30s). */
export const KEEPALIVE_PERIOD_MIN = 0.5

/** Backoff: base y tope (ms). 1s, 2s, 4s, ... hasta 30s. */
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30_000

export class BridgeClient {
  private ws: WebSocketLike | null = null
  private reconnectAttempts = 0
  private closedByUs = false

  private readonly WebSocketImpl: WebSocketCtor
  private readonly dispatch: typeof dispatchCommand
  private readonly persistStatus: typeof writeBridgeStatus
  private readonly scheduleReconnect: (fn: () => void, ms: number) => void

  constructor(
    private readonly config: BridgeClientConfig,
    deps: BridgeClientDeps,
  ) {
    this.WebSocketImpl = deps.WebSocketImpl ?? (globalThis.WebSocket as unknown as WebSocketCtor)
    this.clientInfo = deps.clientInfo
    this.dispatch = deps.dispatch ?? dispatchCommand
    this.persistStatus = deps.persistStatus ?? writeBridgeStatus
    this.scheduleReconnect = deps.scheduleReconnect ?? ((fn, ms) => setTimeout(fn, ms))
  }

  private readonly clientInfo: ClientInfo

  /** Backoff exponencial con tope: 1s, 2s, 4s, ... 30s. */
  private backoffMs(): number {
    const ms = BACKOFF_BASE_MS * 2 ** this.reconnectAttempts
    return Math.min(ms, BACKOFF_MAX_MS)
  }

  /** Abre la conexión y cablea los handlers. Idempotente-ish: cierra el anterior. */
  connect(): void {
    this.closedByUs = false
    if (this.ws) {
      // Evita sockets duplicados si se llama dos veces.
      try {
        this.ws.close()
      } catch {
        /* noop */
      }
      this.ws = null
    }

    const ws = new this.WebSocketImpl(this.config.bridgeUrl)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempts = 0
      const hello: HelloMessage = {
        type: 'hello',
        secret: this.config.secret,
        clientInfo: this.clientInfo,
      }
      ws.send(JSON.stringify(hello))
      void this.persistStatus({ connected: true, lastPingAt: Date.now() })
    }

    ws.onmessage = (ev) => {
      void this.handleMessage(ev.data)
    }

    ws.onerror = () => {
      void this.persistStatus({
        connected: false,
        lastPingAt: Date.now(),
        lastError: 'websocket error',
      })
    }

    ws.onclose = () => {
      this.ws = null
      void this.persistStatus({ connected: false, lastPingAt: Date.now() })
      if (!this.closedByUs) this.scheduleReconnectWithBackoff()
    }
  }

  /** Cierra la conexión sin reintentar (apagado limpio). */
  disconnect(): void {
    this.closedByUs = true
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* noop */
      }
      this.ws = null
    }
  }

  private scheduleReconnectWithBackoff(): void {
    const delay = this.backoffMs()
    this.reconnectAttempts += 1
    this.scheduleReconnect(() => this.connect(), delay)
  }

  /**
   * Procesa un mensaje entrante. Comandos válidos se despachan y se responde un
   * `result`. Mensajes desconocidos / inválidos se ignoran (loguean) SIN romper
   * el socket.
   */
  private async handleMessage(raw: unknown): Promise<void> {
    const command = parseIncomingCommand(raw)
    if (!command) {
      // Comando desconocido o JSON inválido: no rompe el socket.
      console.warn('[kiro] mensaje de bridge ignorado (desconocido/inválido)')
      return
    }

    void this.persistStatus({ connected: true, lastPingAt: Date.now() })

    const payload = await this.dispatch(command)
    const result: ResultMessage = {
      type: 'result',
      correlationId: command.correlationId,
      payload,
    }
    if (this.ws) this.ws.send(JSON.stringify(result))
  }
}

/**
 * Parsea y valida un mensaje crudo del WebSocket a un `IncomingCommandMessage`.
 * Devuelve null si no es un comando reconocido (lo que el caller trata como
 * "ignorar sin romper el socket").
 */
export function parseIncomingCommand(raw: unknown): IncomingCommandMessage | null {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null

  const msg = obj as Record<string, unknown>
  const correlationId = msg.correlationId
  if (typeof correlationId !== 'string') return null

  if (msg.type === 'execute_fetch') {
    const payload = msg.payload as Record<string, unknown> | undefined
    if (!payload || typeof payload.method !== 'string' || typeof payload.url !== 'string') {
      return null
    }
    return {
      type: 'execute_fetch',
      correlationId,
      payload: {
        method: payload.method,
        url: payload.url,
        headers: payload.headers as Record<string, string> | undefined,
        body: typeof payload.body === 'string' ? payload.body : undefined,
      },
    }
  }

  if (msg.type === 'check_session') {
    const payload = msg.payload as Record<string, unknown> | undefined
    if (!payload || typeof payload.bank !== 'string') return null
    return {
      type: 'check_session',
      correlationId,
      payload: { bank: payload.bank },
    }
  }

  return null
}

/**
 * Programa el alarm de keepalive MV3. Al dispararse, el SW (que pudo haberse
 * dormido) re-ejecuta el listener que llama `connect()`. Ver background.ts.
 */
export function ensureKeepaliveAlarm(): void {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MIN })
}
