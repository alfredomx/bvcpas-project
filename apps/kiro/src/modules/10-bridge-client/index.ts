// Cliente WebSocket del bridge (kiro 10-bridge-client).
// Punto de entrada público del módulo.

export {
  BridgeClient,
  parseIncomingCommand,
  ensureKeepaliveAlarm,
  KEEPALIVE_ALARM,
} from './bridge-client'
export type { WebSocketLike, WebSocketCtor, BridgeClientDeps } from './bridge-client'
export { dispatchCommand } from './dispatcher'
export type { DispatchResult } from './dispatcher'
export {
  readBridgeConfig,
  setBridgeToken,
  setBridgeUrl,
  loginToMapi,
  saveOperatorSession,
  readOperatorSession,
  clearOperatorSession,
  httpBaseFromBridgeUrl,
  writeBridgeStatus,
  DEFAULT_BRIDGE_URL,
  STORAGE_KEY_TOKEN,
  STORAGE_KEY_NAME,
  STORAGE_KEY_URL,
  STORAGE_KEY_STATUS,
} from './config'
export type { BridgeStatus, OperatorSession } from './config'
export { registerContentListener, handleRoutedMessage, isRoutedFetchMessage } from './content'
export type {
  BridgeClientConfig,
  ClientInfo,
  HelloMessage,
  ResultMessage,
  IncomingCommandMessage,
  ExecuteFetchPayload,
  CheckSessionPayload,
  RoutedFetchMessage,
} from './types'
