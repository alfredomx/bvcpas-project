/**
 * Contrato de mensajes del bridge mapi↔plugin (kiro). Ver el TDD del módulo
 * (`roadmap/23-plugin-bridge/README.md`) para el protocolo completo.
 *
 *   plugin→mapi:  { type:'hello', token, clientInfo }   (token = JWT del operador, v0.19.0)
 *   mapi→plugin:  { type:'execute_fetch', correlationId, payload:{ method,url,headers,body } }
 *   mapi→plugin:  { type:'check_session', correlationId, payload:{ bank } }
 *   mapi→plugin:  { type:'list_tabs', correlationId }   (sin payload; v0.19.0)
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

/** Una pestaña abierta de Chrome (lo que devuelve `list_tabs`). */
export interface TabInfo {
  tabId: number
  url?: string
  title?: string
  active: boolean
  windowId: number
}

/** Resultado de `list_tabs`: la lista cruda de pestañas; mapi decide cuál usar. */
export interface ListTabsResult {
  tabs: TabInfo[]
}

/**
 * Comando que `BridgeCommandService.send()` despacha al plugin.
 * `list_tabs` no lleva payload (el plugin solo corre `chrome.tabs.query`).
 */
export type BridgeCommand =
  | { type: 'execute_fetch'; payload: ExecuteFetchPayload }
  | { type: 'check_session'; payload: CheckSessionPayload }
  | { type: 'list_tabs'; payload?: undefined }

/** Mensaje saliente (mapi→plugin) ya correlacionado. */
export interface OutgoingCommandMessage {
  type: BridgeCommand['type']
  correlationId: string
  payload?: ExecuteFetchPayload | CheckSessionPayload
}

/** `hello` entrante del plugin (v0.19.0: JWT del operador, ya no shared secret). */
export interface HelloMessage {
  type: 'hello'
  token: string
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
