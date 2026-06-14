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
//   plugin→mapi:  { type:'hello', secret, clientInfo }
//   mapi→plugin:  { type:'execute_fetch', correlationId, payload:{ method,url,headers,body } }
//   mapi→plugin:  { type:'check_session', correlationId, payload:{ bank } }
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

/** Primer mensaje plugin→mapi: autenticación con shared secret. */
export interface HelloMessage {
  type: 'hello'
  secret: string
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

/** Unión de comandos entrantes que el plugin sabe despachar. */
export type IncomingCommandMessage = ExecuteFetchCommandMessage | CheckSessionCommandMessage

/** Respuesta plugin→mapi, correlacionada por `correlationId`. */
export interface ResultMessage {
  type: 'result'
  correlationId: string
  payload: BridgeCommandResult | BridgeErrorPayload
}

/** Payload de error cuando un comando falla o es desconocido. */
export interface BridgeErrorPayload {
  error: string
}

/** Config del cliente bridge: de dónde conectar y con qué secret. */
export interface BridgeClientConfig {
  /** URL del WebSocket del bridge (ej. `ws://localhost:4000/bridge`). */
  bridgeUrl: string
  /** Shared secret para el `hello` (mismo valor que `BRIDGE_SECRET` en mapi). */
  secret: string
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
