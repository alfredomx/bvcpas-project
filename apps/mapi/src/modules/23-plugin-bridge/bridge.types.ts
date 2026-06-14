/**
 * Contrato de mensajes del bridge mapi↔plugin (kiro). Ver el TDD del módulo
 * (`roadmap/23-plugin-bridge/README.md`) para el protocolo completo.
 *
 *   plugin→mapi:  { type:'hello', secret, clientInfo }
 *   mapi→plugin:  { type:'execute_fetch', correlationId, payload:{ method,url,headers,body } }
 *   mapi→plugin:  { type:'check_session', correlationId, payload:{ bank } }
 *   plugin→mapi:  { type:'result', correlationId, payload:{ ...resultado } }
 *
 * `correlationId` (transporte) === `requestId` del executor de kiro.
 */

/** Payload de un `execute_fetch` (la instrucción de fetch que corre el plugin). */
export interface ExecuteFetchPayload {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

/** Payload de un `check_session` (¿hay sesión viva del banco en una pestaña?). */
export interface CheckSessionPayload {
  bank: string
}

/** Comando que `BridgeCommandService.send()` despacha al plugin. */
export type BridgeCommand =
  | { type: 'execute_fetch'; payload: ExecuteFetchPayload }
  | { type: 'check_session'; payload: CheckSessionPayload }

/** Mensaje saliente (mapi→plugin) ya correlacionado. */
export interface OutgoingCommandMessage {
  type: BridgeCommand['type']
  correlationId: string
  payload: ExecuteFetchPayload | CheckSessionPayload
}

/** `hello` entrante del plugin. */
export interface HelloMessage {
  type: 'hello'
  secret: string
  clientInfo?: Record<string, unknown>
}

/** `result` entrante del plugin (respuesta a un comando). */
export interface ResultMessage {
  type: 'result'
  correlationId: string
  payload: unknown
}

/**
 * Subconjunto del socket que el `BridgeCommandService` usa para escribir al
 * plugin. El gateway envuelve el `WebSocket` real; los tests inyectan un fake.
 */
export interface BridgeTransport {
  send(data: string): void
}
