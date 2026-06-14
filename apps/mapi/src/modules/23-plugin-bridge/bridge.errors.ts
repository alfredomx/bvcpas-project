import { DomainError } from '../../common/errors/domain.error'

/**
 * No hay ningún plugin (kiro) conectado al bridge cuando mapi intentó mandar
 * un comando. HTTP 503 (servicio temporalmente no disponible: el operador
 * debe abrir/conectar el plugin).
 */
export class BridgeNotConnectedError extends DomainError {
  readonly code = 'BRIDGE_NOT_CONNECTED'
  constructor() {
    super('No hay plugin conectado al bridge')
  }
}

/**
 * El plugin no respondió un comando dentro del timeout configurado.
 * HTTP 504 (gateway timeout: el upstream —el plugin— no contestó a tiempo).
 */
export class BridgeCommandTimeoutError extends DomainError {
  readonly code = 'BRIDGE_COMMAND_TIMEOUT'
  constructor(correlationId: string, timeoutMs: number) {
    super(`El plugin no respondió el comando ${correlationId} en ${timeoutMs}ms`)
  }
}

/**
 * El `hello` del plugin trajo un secret que no coincide con `BRIDGE_SECRET`.
 * No viaja por HTTP (el gateway cierra el socket); HTTP 401 si llegara a
 * superficie REST.
 */
export class BridgeAuthError extends DomainError {
  readonly code = 'BRIDGE_AUTH_ERROR'
  constructor() {
    super('Secret inválido en el hello del bridge')
  }
}
