import { DomainError } from '@/common/errors/domain.error'

/** No existe el portal bancario (catálogo). */
export class BankPortalNotFoundError extends DomainError {
  readonly code = 'BANK_PORTAL_NOT_FOUND'
  readonly status = 404
  constructor(id: string) {
    super(`No existe el portal bancario ${id}`, { id })
  }
}

/** No existe la credencial (login) bancaria. */
export class BankCredentialNotFoundError extends DomainError {
  readonly code = 'BANK_CREDENTIAL_NOT_FOUND'
  readonly status = 404
  constructor(id: string) {
    super(`No existe la credencial bancaria ${id}`, { id })
  }
}

/** No existe la cuenta individual. */
export class BankAccountNotFoundError extends DomainError {
  readonly code = 'BANK_ACCOUNT_NOT_FOUND'
  readonly status = 404
  constructor(id: string) {
    super(`No existe la cuenta bancaria ${id}`, { id })
  }
}

/** Ya existe un portal con ese nombre (name es único). */
export class BankPortalNameConflictError extends DomainError {
  readonly code = 'BANK_PORTAL_NAME_CONFLICT'
  readonly status = 409
  constructor(name: string) {
    super(`Ya existe un portal con el nombre "${name}"`, { name })
  }
}

/** Ya existe una cuenta con ese mask dentro del mismo login. */
export class BankAccountMaskConflictError extends DomainError {
  readonly code = 'BANK_ACCOUNT_MASK_CONFLICT'
  readonly status = 409
  constructor(mask: string) {
    super(`Ya existe una cuenta con el mask ${mask} en este login`, { mask })
  }
}
