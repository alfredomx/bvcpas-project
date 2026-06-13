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
