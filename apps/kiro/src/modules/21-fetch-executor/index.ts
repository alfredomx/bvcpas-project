// Ejecutor de fetch genérico (kiro 21-fetch-executor).
// Punto de entrada público del módulo.

export { executeFetch, checkSession } from './fetch-executor'
export { handleBridgeCommand } from './bridge-handler'
export type {
  HttpMethod,
  BodyEncoding,
  FetchInstruction,
  FetchResult,
  CheckSessionInstruction,
  CheckSessionResult,
  ExecuteFetchCommand,
  CheckSessionCommand,
  BridgeCommand,
  BridgeCommandResult,
} from './types'
