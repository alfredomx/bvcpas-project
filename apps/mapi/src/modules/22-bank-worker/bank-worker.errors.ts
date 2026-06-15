import { DomainError } from '../../common/errors/domain.error'

export class BankPortalNotFoundError extends DomainError {
  readonly code = 'BANK_PORTAL_NOT_FOUND'
  constructor(portalId: string) {
    super(`Bank portal ${portalId} no existe`)
  }
}

export class BankPortalAlreadyExistsError extends DomainError {
  readonly code = 'BANK_PORTAL_ALREADY_EXISTS'
  constructor(name: string) {
    super(`Ya existe un portal con nombre "${name}"`)
  }
}

export class BankPortalInUseError extends DomainError {
  readonly code = 'BANK_PORTAL_IN_USE'
  constructor(portalId: string) {
    super(`Bank portal ${portalId} tiene credenciales asociadas y no puede eliminarse`)
  }
}

export class ClientBankAccountNotFoundError extends DomainError {
  readonly code = 'CLIENT_BANK_ACCOUNT_NOT_FOUND'
  constructor(credentialId: string) {
    super(`Credencial bancaria ${credentialId} no existe`)
  }
}

export class BankAccountNotFoundError extends DomainError {
  readonly code = 'BANK_ACCOUNT_NOT_FOUND'
  constructor(accountId: string) {
    super(`Cuenta bancaria ${accountId} no existe`)
  }
}

export class BankAccountMaskConflictError extends DomainError {
  readonly code = 'BANK_ACCOUNT_MASK_CONFLICT'
  constructor(mask: string) {
    super(`Ya existe una cuenta con mask "${mask}" dentro de ese login`)
  }
}

// ── Adapters / Design B (v0.18.0) ──────────────────────────────────────────

/**
 * El plugin no pudo ejecutar el fetch contra el banco (error de red, o el
 * banco respondió no-2xx). HTTP 502 (el upstream —el banco vía plugin— falló).
 */
export class BankFetchError extends DomainError {
  readonly code = 'BANK_FETCH_ERROR'
  constructor(message: string) {
    super(`Fetch al banco falló: ${message}`)
  }
}

/** No se encontró una cuenta con esa mask en la sesión del banco. HTTP 404. */
export class ChaseAccountNotFoundError extends DomainError {
  readonly code = 'CHASE_ACCOUNT_NOT_FOUND'
  constructor(mask: string) {
    super(`No se encontró ninguna cuenta de Chase con terminación ${mask}`)
  }
}

/** Fallo genérico del adapter bancario (respuesta inesperada). HTTP 502. */
export class BankAdapterError extends DomainError {
  readonly code = 'BANK_ADAPTER_ERROR'
  constructor(message: string) {
    super(`Adapter bancario: ${message}`)
  }
}

// ── Step-flow de descarga (v0.21.0) ─────────────────────────────────────────

/**
 * El portal del cliente no tiene un adapter de descarga implementado (ej.
 * RBFCU aún no está portado a Design B). HTTP 501 (no implementado).
 */
export class BankAdapterNotSupportedError extends DomainError {
  readonly code = 'BANK_ADAPTER_NOT_SUPPORTED'
  constructor(portalName: string) {
    super(`No hay adapter de descarga implementado para el portal "${portalName}"`)
  }
}

/**
 * La credencial no tiene cuentas activas registradas (`bank_accounts`) para
 * descargar. El operador debe registrar los masks primero. HTTP 409.
 */
export class NoBankAccountsRegisteredError extends DomainError {
  readonly code = 'NO_BANK_ACCOUNTS_REGISTERED'
  constructor(credentialId: string) {
    super(`La credencial ${credentialId} no tiene cuentas activas registradas para descargar`)
  }
}

/**
 * El `accountMask` pedido no es una cuenta registrada de esa credencial. HTTP 404.
 */
export class BankAccountMaskNotFoundError extends DomainError {
  readonly code = 'BANK_ACCOUNT_MASK_NOT_FOUND'
  constructor(mask: string) {
    super(`No hay una cuenta registrada con terminación ${mask} en esa credencial`)
  }
}

/**
 * El portal no tiene login automatizado (el adapter no implementa
 * `buildLoginRecipe`). HTTP 501.
 */
export class BankLoginNotSupportedError extends DomainError {
  readonly code = 'BANK_LOGIN_NOT_SUPPORTED'
  constructor(portalName: string) {
    super(`El portal "${portalName}" no tiene login automatizado implementado`)
  }
}

/**
 * No se pudo establecer la sesión del banco tras el login (las credenciales
 * fallaron, MFA/device-trust pendiente, o el banco no respondió). HTTP 502.
 */
export class BankSessionNotEstablishedError extends DomainError {
  readonly code = 'BANK_SESSION_NOT_ESTABLISHED'
  constructor(portalName: string) {
    super(
      `No se pudo establecer la sesión de "${portalName}" tras el login ` +
        `(credenciales, MFA/device-trust, o el banco no respondió)`,
    )
  }
}
