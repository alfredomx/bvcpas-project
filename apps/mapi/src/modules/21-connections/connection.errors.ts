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

/**
 * Lanzado cuando un endpoint de ESCRITURA sobre Intuit no encuentra
 * conexión personal del user actual con scope_type='full'. El frontend
 * debe ofrecer "Conecta tu Intuit personal" cuando recibe este 403.
 */
export class IntuitPersonalConnectionRequiredError extends DomainError {
  readonly code = 'INTUIT_PERSONAL_CONNECTION_REQUIRED'
  constructor(clientId: string) {
    super(
      `Para esta acción se requiere tu conexión personal de Intuit en el cliente ${clientId}. La cuenta global solo permite lectura.`,
    )
  }
}

/**
 * v0.10.0 — Sharing.
 * Lanzado cuando un user que NO es dueño de la conexión intenta
 * gestionar shares (POST/PATCH/DELETE/GET shared list).
 */
export class ConnectionNotOwnerError extends DomainError {
  readonly code = 'CONNECTION_NOT_OWNER'
  constructor(connectionId: string) {
    super(`Solo el dueño de la conexión ${connectionId} puede gestionar accesos compartidos`)
  }
}

/**
 * Lanzado en PATCH/DELETE share cuando el (connection_id, user_id) no
 * existe en `connection_access`.
 */
export class ConnectionShareNotFoundError extends DomainError {
  readonly code = 'CONNECTION_SHARE_NOT_FOUND'
  constructor(connectionId: string, userId: string) {
    super(`No existe share para conexión ${connectionId} y user ${userId}`)
  }
}

/**
 * Lanzado cuando el dueño intenta compartirse consigo mismo.
 */
export class ConnectionShareSelfError extends DomainError {
  readonly code = 'CONNECTION_SHARE_SELF'
  constructor() {
    super('No puedes compartir una conexión contigo mismo (ya eres el dueño)')
  }
}

/**
 * Lanzado en POST share cuando el target_user_id ya tiene una row en
 * `connection_access`. Sugerir PATCH para cambiar permission.
 */
export class ConnectionShareDuplicateError extends DomainError {
  readonly code = 'CONNECTION_SHARE_DUPLICATE'
  constructor(connectionId: string, userId: string) {
    super(
      `El user ${userId} ya tiene acceso compartido a la conexión ${connectionId}. Usa PATCH para cambiar permission.`,
    )
  }
}

/**
 * Lanzado en POST share cuando el target_user_id no existe en `users`.
 * Evita 500 por FK violation y devuelve un 404 amigable.
 */
export class ConnectionShareTargetUserNotFoundError extends DomainError {
  readonly code = 'CONNECTION_SHARE_TARGET_USER_NOT_FOUND'
  constructor(userId: string) {
    super(`El user ${userId} no existe`)
  }
}

/**
 * v0.11.0 — Lanzado cuando se intenta crear/actualizar una conexión
 * api_key con credentials que no cumplen el shape esperado por el
 * provider concreto. Ej. Clover requiere `{api_token, merchant_id}`.
 */
export class CredentialsShapeError extends DomainError {
  readonly code = 'CREDENTIALS_SHAPE_INVALID'
  constructor(provider: string, missingField: string) {
    super(`credentials inválido para provider ${provider}: falta o vacío ${missingField}`)
  }
}
