/**
 * Contrato del bridge mapi↔kiro (D-core-027). Define el **protocolo compartido**
 * (comandos/resultados/pasos DOM) + el **puerto**. El plugin `kiro-bridge` lo
 * implementa y lo liga `@Global`; los consumidores (`bank-downloader`) inyectan
 * `BRIDGE_COMMAND_PORT` y usan estos tipos, sin importar el plugin `kiro-bridge`.
 *
 * `correlationId` (transporte) === `requestId` del executor de kiro.
 */
export const BRIDGE_COMMAND_PORT = Symbol('BRIDGE_COMMAND_PORT')

/** Payload de un `execute_fetch` (instrucción de fetch que corre el plugin). */
export interface ExecuteFetchPayload {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

/** Payload de `check_session` (¿hay sesión viva del banco en una pestaña?). */
export interface CheckSessionPayload {
  bank: string
}

/** Payload de `open_tab` (abrir pestaña en `url` y esperar carga). */
export interface OpenTabPayload {
  url: string
}

/** Resultado de `open_tab`: la pestaña creada (ya cargada). */
export interface OpenTabResult {
  tabId: number
  url: string
}

/** Payload de `close_tab`: la pestaña a cerrar. */
export interface CloseTabPayload {
  tabId: number
}

/** Resultado de `close_tab`. `closed=false` si ya no existía (idempotente). */
export interface CloseTabResult {
  tabId: number
  closed: boolean
}

/**
 * Un paso DOM genérico (espejo del intérprete de kiro). `selector`/`value` los
 * arma mapi; el plugin solo ejecuta. NO contiene lógica de banco.
 */
export type DomStep =
  | { op: 'fill'; selector: string; value: string }
  | { op: 'click'; selector: string }
  | { op: 'waitFor'; selector: string; timeoutMs?: number }
  | { op: 'getText'; selector: string }

/** Payload de `execute_dom`: pestaña objetivo + receta. */
export interface ExecuteDomPayload {
  tabId: number
  steps: DomStep[]
}

/** Resultado de un paso (`value` solo para `getText`). */
export interface DomStepResult {
  op: DomStep['op']
  ok: boolean
  value?: string
}

/** Resultado de ejecutar una receta DOM. */
export interface DomResult {
  requestId: string
  ok: boolean
  results: DomStepResult[]
  failedStep?: number
  error?: string
}

/** Una pestaña abierta de Chrome (lo que devuelve `list_tabs`). */
export interface TabInfo {
  tabId: number
  url?: string
  title?: string
  active: boolean
  windowId: number
}

/** Resultado de `list_tabs`: lista cruda; mapi decide cuál usar. */
export interface ListTabsResult {
  tabs: TabInfo[]
}

/** Comando que el puerto despacha al plugin. `list_tabs` no lleva payload. */
export type BridgeCommand =
  | { type: 'execute_fetch'; payload: ExecuteFetchPayload }
  | { type: 'check_session'; payload: CheckSessionPayload }
  | { type: 'list_tabs'; payload?: undefined }
  | { type: 'execute_dom'; payload: ExecuteDomPayload }
  | { type: 'open_tab'; payload: OpenTabPayload }
  | { type: 'close_tab'; payload: CloseTabPayload }

export interface BridgeCommandPort {
  /**
   * Manda un comando al plugin (kiro) y resuelve con su `result.payload`.
   * @throws BridgeNotConnectedError (503) si no hay plugin conectado.
   * @throws BridgeCommandTimeoutError (504) si el plugin no responde a tiempo.
   */
  send(command: BridgeCommand): Promise<unknown>
  /** ¿Hay un plugin conectado ahora mismo? */
  isPluginConnected(): boolean
}
