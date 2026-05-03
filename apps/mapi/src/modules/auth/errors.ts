import { DomainError } from '../../common/errors/domain.error'

/**
 * Errores de dominio del módulo 10-core-auth.
 *
 * Mapping a HTTP status vive en `common/errors/domain-error.filter.ts`
 * dentro de `STATUS_BY_CODE`.
 */

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND'
}

export class EmailAlreadyExistsError extends DomainError {
  readonly code = 'EMAIL_ALREADY_EXISTS'
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS'

  constructor(details?: Record<string, unknown>) {
    super('Credenciales inválidas', details)
  }
}

export class UserDisabledError extends DomainError {
  readonly code = 'USER_DISABLED'

  constructor(details?: Record<string, unknown>) {
    super('Cuenta deshabilitada', details)
  }
}

export class SessionRevokedError extends DomainError {
  readonly code = 'SESSION_REVOKED'

  constructor(details?: Record<string, unknown>) {
    super('Sesión revocada', details)
  }
}

export class SessionExpiredError extends DomainError {
  readonly code = 'SESSION_EXPIRED'

  constructor(details?: Record<string, unknown>) {
    super('Sesión expirada', details)
  }
}

export class SessionNotFoundError extends DomainError {
  readonly code = 'SESSION_NOT_FOUND'
}

export class InsufficientPermissionsError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSIONS'

  constructor(details?: Record<string, unknown>) {
    super('Permisos insuficientes', details)
  }
}

export class WeakPasswordError extends DomainError {
  readonly code = 'WEAK_PASSWORD'

  constructor(details?: Record<string, unknown>) {
    super('La contraseña no cumple con los requisitos mínimos', details)
  }
}

export class WrongOldPasswordError extends DomainError {
  readonly code = 'WRONG_OLD_PASSWORD'

  constructor() {
    super('La contraseña actual es incorrecta')
  }
}
