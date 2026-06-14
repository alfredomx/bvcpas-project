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
