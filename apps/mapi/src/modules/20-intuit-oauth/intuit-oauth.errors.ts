import { DomainError } from '../../common/errors/domain.error'

/**
 * Errores de dominio del módulo 20-intuit-oauth.
 *
 * Mapping a HTTP status vive en `common/errors/domain-error.filter.ts`
 * dentro de `STATUS_BY_CODE`.
 */

export class IntuitTokensNotFoundError extends DomainError {
  readonly code = 'INTUIT_TOKENS_NOT_FOUND'
  constructor(clientId: string) {
    super(`No hay tokens Intuit para el cliente: ${clientId}`)
  }
}

export class IntuitRefreshTokenExpiredError extends DomainError {
  readonly code = 'INTUIT_REFRESH_EXPIRED'
  constructor(clientId: string) {
    super(`Refresh token expirado para cliente: ${clientId}, requiere re-autorización`)
  }
}

export class IntuitAuthorizationError extends DomainError {
  readonly code = 'INTUIT_AUTH_ERROR'
}

export class IntuitBadRequestError extends DomainError {
  readonly code = 'INTUIT_BAD_REQUEST'
  constructor(message: string, qboErrors?: unknown) {
    super(message, qboErrors ? { qboErrors } : undefined)
  }
}

export class IntuitStateInvalidError extends DomainError {
  readonly code = 'INTUIT_STATE_INVALID'
  constructor() {
    super('OAuth state inválido o expirado (posible CSRF o link viejo)')
  }
}

export class ClientNotFoundError extends DomainError {
  readonly code = 'CLIENT_NOT_FOUND'
  constructor(clientId: string) {
    super(`Cliente no encontrado: ${clientId}`)
  }
}
