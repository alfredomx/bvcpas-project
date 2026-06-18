import type {
  BridgeCommand,
  CheckSessionPayload,
  CloseTabPayload,
  ExecuteDomPayload,
  ExecuteFetchPayload,
  OpenTabPayload,
} from '@/contracts/bridge.port'

/**
 * Subconjunto del socket que el `BridgeCommandService` usa para escribir al
 * plugin. El gateway envuelve el `WebSocket` real; los tests inyectan un fake.
 */
export interface BridgeTransport {
  send(data: string): void
}

/** Mensaje saliente (mapi→plugin) ya correlacionado. */
export interface OutgoingCommandMessage {
  type: BridgeCommand['type']
  correlationId: string
  payload?:
    | ExecuteFetchPayload
    | CheckSessionPayload
    | ExecuteDomPayload
    | OpenTabPayload
    | CloseTabPayload
}
