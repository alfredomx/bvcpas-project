import { DomainError } from '@/common/errors/domain.error'

/** El plugin no pudo ejecutar el fetch (error de red, o el banco respondió no-2xx). */
export class BankFetchError extends DomainError {
  readonly code = 'BANK_FETCH_ERROR'
  readonly status = 502
  constructor(message: string) {
    super(`Fetch al banco falló: ${message}`)
  }
}

/** Fallo genérico del adapter bancario (respuesta inesperada). */
export class BankAdapterError extends DomainError {
  readonly code = 'BANK_ADAPTER_ERROR'
  readonly status = 502
  constructor(message: string) {
    super(`Adapter bancario: ${message}`)
  }
}

/** No se encontró una cuenta con esa mask en la sesión del banco. */
export class ChaseAccountNotFoundError extends DomainError {
  readonly code = 'CHASE_ACCOUNT_NOT_FOUND'
  readonly status = 404
  constructor(mask: string) {
    super(`No se encontró ninguna cuenta de Chase con terminación ${mask}`)
  }
}

/** El portal del cliente no tiene un adapter de descarga implementado. */
export class BankAdapterNotSupportedError extends DomainError {
  readonly code = 'BANK_ADAPTER_NOT_SUPPORTED'
  readonly status = 501
  constructor(portalName: string) {
    super(`No hay adapter de descarga implementado para el portal "${portalName}"`)
  }
}

/** El portal no tiene login automatizado (el adapter no implementa `buildLoginRecipe`). */
export class BankLoginNotSupportedError extends DomainError {
  readonly code = 'BANK_LOGIN_NOT_SUPPORTED'
  readonly status = 501
  constructor(portalName: string) {
    super(`El portal "${portalName}" no tiene login automatizado implementado`)
  }
}

/** No se pudo establecer la sesión del banco tras el login (creds, MFA, o sin respuesta). */
export class BankSessionNotEstablishedError extends DomainError {
  readonly code = 'BANK_SESSION_NOT_ESTABLISHED'
  readonly status = 502
  constructor(portalName: string) {
    super(
      `No se pudo establecer la sesión de "${portalName}" tras el login ` +
        `(credenciales, MFA/device-trust, o el banco no respondió)`,
    )
  }
}
