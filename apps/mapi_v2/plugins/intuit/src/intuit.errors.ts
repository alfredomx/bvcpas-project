import { DomainError } from '@/common/errors/domain.error'

/** El cliente no tiene conexión QBO (no hay row en intuit_tokens). */
export class IntuitTokensNotFoundError extends DomainError {
  readonly code = 'INTUIT_TOKENS_NOT_FOUND'
  readonly status = 404
  constructor(clientId: string) {
    super(`No hay conexión QBO para el cliente ${clientId}`, { clientId })
  }
}

/** El refresh token venció — requiere re-autorización (volver a hacer OAuth). */
export class IntuitRefreshExpiredError extends DomainError {
  readonly code = 'INTUIT_REFRESH_EXPIRED'
  readonly status = 401
  constructor(clientId: string) {
    super(`Refresh token vencido para el cliente ${clientId}, requiere re-autorización`, {
      clientId,
    })
  }
}

/** state OAuth inválido o expirado (posible CSRF o link viejo). */
export class IntuitStateInvalidError extends DomainError {
  readonly code = 'INTUIT_STATE_INVALID'
  readonly status = 400
  constructor() {
    super('state OAuth inválido o expirado (posible CSRF o link viejo)')
  }
}

/** El realm ya está ligado a OTRO cliente. */
export class IntuitRealmConflictError extends DomainError {
  readonly code = 'INTUIT_REALM_CONFLICT'
  readonly status = 409
  constructor(realmId: string) {
    super(`El realm ${realmId} ya está ligado a otro cliente`, { realmId })
  }
}

/** Falló el exchange/refresh contra Intuit (no es culpa del request del usuario). */
export class IntuitAuthError extends DomainError {
  readonly code = 'INTUIT_AUTH_ERROR'
  readonly status = 502
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}

/** QBO devolvió un 4xx en una `call` (request inválido). */
export class IntuitBadRequestError extends DomainError {
  readonly code = 'INTUIT_BAD_REQUEST'
  readonly status = 400
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}
