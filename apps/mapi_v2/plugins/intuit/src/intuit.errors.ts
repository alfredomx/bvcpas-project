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

/**
 * En un reconnect, la compañía QBO autorizada NO coincide con la que el cliente
 * ya tiene ligada. Anti-mixup: no se cambia el realm en silencio. Para mover un
 * cliente a otra compañía, primero desconéctalo (DELETE connection) y reconecta.
 */
export class IntuitRealmMismatchError extends DomainError {
  readonly code = 'INTUIT_REALM_MISMATCH'
  readonly status = 409
  constructor(expectedRealm: string, gotRealm: string) {
    super(
      `La compañía autorizada (${gotRealm}) no coincide con la del cliente (${expectedRealm}); desconecta primero para cambiar de compañía.`,
      { expectedRealm, gotRealm },
    )
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

/**
 * Una lista auto-paginada superó el tope de seguridad. No se trunca en silencio:
 * el caller debe acotar (fechas/filtro) o usar paginación manual / backfill.
 */
export class IntuitTooManyRecordsError extends DomainError {
  readonly code = 'INTUIT_TOO_MANY_RECORDS'
  readonly status = 400
  constructor(entity: string, cap: number) {
    super(
      `La lista de '${entity}' supera el tope de ${cap} registros; acota el rango/filtro o usa paginación manual (startPosition/maxResults).`,
      { entity, cap },
    )
  }
}
