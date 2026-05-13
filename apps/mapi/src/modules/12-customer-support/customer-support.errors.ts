import { DomainError } from '../../common/errors/domain.error'

/**
 * Errores de dominio del módulo 12-customer-support.
 *
 * Mapping a HTTP status vive en `common/errors/domain-error.filter.ts` dentro
 * de `STATUS_BY_CODE`.
 */

export class ClientNotConnectedError extends DomainError {
  readonly code = 'CLIENT_NOT_CONNECTED'
  constructor(clientId: string) {
    super(`Cliente ${clientId} no tiene QBO conectado (qbo_realm_id es null)`)
  }
}

export class PublicLinkInvalidError extends DomainError {
  readonly code = 'PUBLIC_LINK_INVALID'
  constructor() {
    super('Token público inválido')
  }
}

export class PublicLinkRevokedError extends DomainError {
  readonly code = 'PUBLIC_LINK_REVOKED'
  constructor() {
    super('Token público revocado')
  }
}

export class PublicLinkExpiredError extends DomainError {
  readonly code = 'PUBLIC_LINK_EXPIRED'
  constructor() {
    super('Token público expirado o agotó su número de usos')
  }
}

export class PublicLinkPurposeMismatchError extends DomainError {
  readonly code = 'PUBLIC_LINK_PURPOSE_MISMATCH'
  constructor() {
    super('Token público válido pero no para este propósito')
  }
}

export class PublicLinkActiveConflictError extends DomainError {
  readonly code = 'PUBLIC_LINK_ACTIVE_CONFLICT'
  constructor(purpose: string) {
    super(
      `Ya existe otro link activo para este cliente con purpose='${purpose}'. Revoca el otro antes de anular este.`,
    )
  }
}

export class TransactionNotFoundInSnapshotError extends DomainError {
  readonly code = 'TRANSACTION_NOT_FOUND_IN_SNAPSHOT'
  constructor(qboTxnId: string) {
    super(`Transacción ${qboTxnId} no existe en el snapshot actual`)
  }
}

// QBO writeback (PATCH .../responses/:txnId?qbo_sync=true)

export class QboAccountIdRequiredError extends DomainError {
  readonly code = 'QBO_ACCOUNT_ID_REQUIRED'
  constructor() {
    super('qbo_account_id es requerido cuando qbo_sync=true (sin cuenta no hay writeback)')
  }
}

export class QboTxnTypeNotSupportedError extends DomainError {
  readonly code = 'TXN_TYPE_NOT_SUPPORTED'
  constructor(qboTxnType: string) {
    super(`Writeback no soportado para qbo_txn_type=${qboTxnType} (v1: solo Purchase, Deposit)`)
  }
}

export class QboStaleSyncTokenError extends DomainError {
  readonly code = 'INTUIT_STALE_SYNC_TOKEN'
  constructor(qboTxnId: string) {
    super(
      `La transacción ${qboTxnId} fue editada en QBO mientras intentábamos actualizarla. Recarga y vuelve a intentar.`,
    )
  }
}
