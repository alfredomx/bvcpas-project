import { DomainError } from '../../common/errors/domain.error'

/**
 * Errores de dominio del módulo 14-call-logs.
 *
 * Mapping a HTTP status vive en `common/errors/domain-error.filter.ts` dentro
 * de `STATUS_BY_CODE`.
 */

export class CallLogNotFoundError extends DomainError {
  readonly code = 'CALL_LOG_NOT_FOUND'
  constructor(logId: string) {
    super(`Call log ${logId} no existe o ya fue eliminado`)
  }
}
