import { DomainError } from '@/common/errors/domain.error'

/** No hay plugin (kiro) conectado al bridge cuando mapi quiso mandar un comando. */
export class BridgeNotConnectedError extends DomainError {
  readonly code = 'BRIDGE_NOT_CONNECTED'
  readonly status = 503
  constructor() {
    super('No hay plugin (kiro) conectado al bridge')
  }
}

/** El plugin no respondió un comando dentro del timeout. */
export class BridgeCommandTimeoutError extends DomainError {
  readonly code = 'BRIDGE_COMMAND_TIMEOUT'
  readonly status = 504
  constructor(correlationId: string, timeoutMs: number) {
    super(`El plugin no respondió el comando ${correlationId} en ${timeoutMs}ms`, {
      correlationId,
      timeoutMs,
    })
  }
}
