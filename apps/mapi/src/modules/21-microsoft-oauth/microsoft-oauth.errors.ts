import { DomainError } from '../../common/errors/domain.error'

/**
 * Errores de dominio del módulo 21-microsoft-oauth.
 *
 * Mapping a HTTP status vive en `common/errors/domain-error.filter.ts`
 * dentro de `STATUS_BY_CODE`.
 */

export class MicrosoftTokensNotFoundError extends DomainError {
  readonly code = 'MICROSOFT_TOKENS_NOT_FOUND'
  constructor(userId: string) {
    super(`No hay tokens Microsoft para el usuario: ${userId}`)
  }
}

export class MicrosoftRefreshExpiredError extends DomainError {
  readonly code = 'MICROSOFT_REFRESH_EXPIRED'
  constructor(userId: string) {
    super(`Refresh token expirado o revocado para usuario: ${userId}, requiere re-autorización`)
  }
}

export class MicrosoftStateInvalidError extends DomainError {
  readonly code = 'MICROSOFT_STATE_INVALID'
  constructor() {
    super('OAuth state inválido o expirado (posible CSRF o link viejo)')
  }
}

export class MicrosoftAuthError extends DomainError {
  readonly code = 'MICROSOFT_AUTH_ERROR'
}

export class MicrosoftGraphError extends DomainError {
  readonly code = 'MICROSOFT_GRAPH_ERROR'
  constructor(message: string, statusCode?: number, body?: unknown) {
    super(
      message,
      statusCode !== undefined || body !== undefined ? { statusCode, body } : undefined,
    )
  }
}
