// Contrato de transporte del bridge cliente (kiro 10-bridge-client).
//
// Estos tipos describen los mensajes que viajan por el WebSocket entre el
// plugin (kiro) y mapi. La fuente de verdad del protocolo es mapi
// `23-plugin-bridge`. kiro copia el shape aquí como referencia local.
//
// IMPORTANTE: si mapi cambia el contrato, NO se modifica aquí primero —
// se actualiza mapi y luego kiro. (Regla del proyecto, ver BACKLOG.)
//
// Protocolo (RPC sobre WebSocket):
//   plugin→mapi:  { type:'hello', token, clientInfo }   (token = JWT del operador, v0.19.0)
//   mapi→plugin:  { type:'execute_fetch', correlationId, payload:{ method,url,headers,body } }
//   mapi→plugin:  { type:'check_session', correlationId, payload:{ bank } }
//   mapi→plugin:  { type:'list_tabs', correlationId }   (sin payload; v0.19.0)
//   mapi→plugin:  { type:'open_tab', correlationId, payload:{ url } }   (abre pestaña + espera load)
//   mapi→plugin:  { type:'close_tab', correlationId, payload:{ tabId } } (cierra pestaña; v0.6.0)
//   plugin→mapi:  { type:'result', correlationId, payload:{ ...resultado } }
//
// `correlationId` (transporte) === `requestId` del executor. Mismo concepto.

import type { BridgeCommandResult } from '../21-fetch-executor/types'
import type { DomResult, DomStep } from '../22-dom-executor/types'

/** Info que el plugin se anuncia a mapi al conectar. */
export interface ClientInfo {
  /** Versión del plugin (de manifest/package). */
  version: string
  /** Identificador legible del agente (ej. user agent corto). */
  userAgent?: string
}

/** Primer mensaje plugin→mapi: autenticación con JWT del operador (v0.19.0). */
export interface HelloMessage {
  type: 'hello'
  token: string
  clientInfo: ClientInfo
}

/** Payload de un `execute_fetch` tal como lo manda mapi (sin `requestId`). */
export interface ExecuteFetchPayload {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

/** Payload de un `check_session` tal como lo manda mapi. */
export interface CheckSessionPayload {
  bank: string
}

/** Comando entrante mapi→plugin: ejecutar un fetch en la pestaña del banco. */
export interface ExecuteFetchCommandMessage {
  type: 'execute_fetch'
  correlationId: string
  payload: ExecuteFetchPayload
}

/** Comando entrante mapi→plugin: verificar sesión (corre en el SW). */
export interface CheckSessionCommandMessage {
  type: 'check_session'
  correlationId: string
  payload: CheckSessionPayload
}

/** Comando entrante mapi→plugin: listar las pestañas abiertas (corre en el SW). */
export interface ListTabsCommandMessage {
  type: 'list_tabs'
  correlationId: string
}

/** Payload de un `open_tab`: la URL a abrir en una pestaña nueva. */
export interface OpenTabPayload {
  url: string
}

/**
 * Comando entrante mapi→plugin: abrir una pestaña nueva en `url` (corre en el SW
 * con `chrome.tabs.create`) y esperar a que cargue. mapi lo usa cuando no hay una
 * pestaña del portal abierta; el SW sobrevive a la navegación y puede responder.
 */
export interface OpenTabCommandMessage {
  type: 'open_tab'
  correlationId: string
  payload: OpenTabPayload
}

/** Payload de un `close_tab`: la pestaña a cerrar (`tabId`, de `list_tabs`/`open_tab`). */
export interface CloseTabPayload {
  tabId: number
}

/**
 * Comando entrante mapi→plugin: cerrar una pestaña (corre en el SW con
 * `chrome.tabs.remove`). mapi lo usa al terminar la extracción para cerrar la
 * pestaña del portal bancario tras desloguear (receta de logout por execute_dom).
 */
export interface CloseTabCommandMessage {
  type: 'close_tab'
  correlationId: string
  payload: CloseTabPayload
}

/**
 * Payload de un `execute_dom`: la pestaña objetivo (`tabId`, sacado de
 * `list_tabs`) y la receta de pasos DOM. Los selectores/valores los dicta mapi.
 */
export interface ExecuteDomPayload {
  tabId: number
  steps: DomStep[]
}

/** Comando entrante mapi→plugin: ejecutar una receta DOM en una pestaña. */
export interface ExecuteDomCommandMessage {
  type: 'execute_dom'
  correlationId: string
  payload: ExecuteDomPayload
}

/** Unión de comandos entrantes que el plugin sabe despachar. */
export type IncomingCommandMessage =
  | ExecuteFetchCommandMessage
  | CheckSessionCommandMessage
  | ListTabsCommandMessage
  | ExecuteDomCommandMessage
  | OpenTabCommandMessage
  | CloseTabCommandMessage

/** Una pestaña abierta (lo que `list_tabs` devuelve; mapi decide cuál usar). */
export interface TabInfo {
  tabId: number
  url?: string
  title?: string
  active: boolean
  windowId: number
}

/** Resultado de `list_tabs`. */
export interface ListTabsResult {
  tabs: TabInfo[]
}

/** Resultado de `open_tab`: la pestaña creada (ya cargada). */
export interface OpenTabResult {
  tabId: number
  url: string
}

/**
 * Resultado de `close_tab`. `closed=false` si la pestaña ya no existía (cerrada
 * por el usuario, navegada, etc.) → idempotente: no es error.
 */
export interface CloseTabResult {
  tabId: number
  closed: boolean
}

/** Respuesta plugin→mapi, correlacionada por `correlationId`. */
export interface ResultMessage {
  type: 'result'
  correlationId: string
  payload:
    | BridgeCommandResult
    | ListTabsResult
    | DomResult
    | OpenTabResult
    | CloseTabResult
    | BridgeErrorPayload
}

/** Payload de error cuando un comando falla o es desconocido. */
export interface BridgeErrorPayload {
  error: string
}

/** Config del cliente bridge: de dónde conectar y con qué JWT. */
export interface BridgeClientConfig {
  /** URL del WebSocket del bridge (ej. `ws://localhost:4000/bridge`). */
  bridgeUrl: string
  /** JWT del operador para el `hello` (obtenido del login a mapi). */
  token: string
}

/**
 * Mensaje interno SW→content-script para rutear un `execute_fetch` a la
 * pestaña correcta. No viaja por el WebSocket — viaja por
 * `chrome.tabs.sendMessage`. El content script responde con un `FetchResult`.
 */
export interface RoutedFetchMessage {
  kind: 'kiro:execute_fetch'
  correlationId: string
  payload: ExecuteFetchPayload
}

/**
 * Mensaje interno SW→content-script para rutear un `execute_dom` a la pestaña
 * objetivo. Viaja por `chrome.tabs.sendMessage`, no por el WebSocket. El content
 * script ejecuta la receta y responde con un `DomResult`.
 */
export interface RoutedDomMessage {
  kind: 'kiro:execute_dom'
  correlationId: string
  payload: ExecuteDomPayload
}
