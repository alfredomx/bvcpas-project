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
//   plugin→mapi:  { type:'result', correlationId, payload:{ ...resultado } }
//
// `correlationId` (transporte) === `requestId` del executor. Mismo concepto.

import type { BridgeCommandResult } from '../21-fetch-executor/types'

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

/** Unión de comandos entrantes que el plugin sabe despachar. */
export type IncomingCommandMessage =
  | ExecuteFetchCommandMessage
  | CheckSessionCommandMessage
  | ListTabsCommandMessage

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

/** Respuesta plugin→mapi, correlacionada por `correlationId`. */
export interface ResultMessage {
  type: 'result'
  correlationId: string
  payload: BridgeCommandResult | ListTabsResult | BridgeErrorPayload
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
