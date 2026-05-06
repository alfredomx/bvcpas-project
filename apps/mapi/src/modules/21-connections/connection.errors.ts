import { DomainError } from '../../common/errors/domain.error'

/**
 * Errores de dominio del módulo 21-connections (v0.7.0). Reemplazan a
 * los `MICROSOFT_*` de v0.6.2.
 *
 * Mapping a HTTP status vive en `common/errors/domain-error.filter.ts`
 * dentro de `STATUS_BY_CODE`.
 */

export class ConnectionNotFoundError extends DomainError {
  readonly code = 'CONNECTION_NOT_FOUND'
  constructor(connectionId: string) {
    super(`Conexión no encontrada o no pertenece al usuario: ${connectionId}`)
  }
}

export class ConnectionRefreshExpiredError extends DomainError {
  readonly code = 'CONNECTION_REFRESH_EXPIRED'
  constructor(connectionId: string) {
    super(`Refresh token expirado/revocado para conexión: ${connectionId}, requiere reconectar`)
  }
}

export class ConnectionAuthError extends DomainError {
  readonly code = 'CONNECTION_AUTH_ERROR'
}

export class ConnectionStateInvalidError extends DomainError {
  readonly code = 'CONNECTION_STATE_INVALID'
  constructor() {
    super('OAuth state inválido o expirado (posible CSRF o link viejo)')
  }
}

export class ProviderNotSupportedError extends DomainError {
  readonly code = 'PROVIDER_NOT_SUPPORTED'
  constructor(provider: string) {
    super(`Provider no soportado todavía: ${provider}`)
  }
}

export class ProviderApiError extends DomainError {
  readonly code = 'PROVIDER_API_ERROR'
  constructor(message: string, statusCode?: number, body?: unknown) {
    super(
      message,
      statusCode !== undefined || body !== undefined ? { statusCode, body } : undefined,
    )
  }
}
