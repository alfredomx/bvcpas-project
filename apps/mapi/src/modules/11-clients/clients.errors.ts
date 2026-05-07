import { DomainError } from '../../common/errors/domain.error'

/**
 * Errores de dominio del módulo `11-clients`.
 *
 * Mapping a HTTP status vive en `common/errors/domain-error.filter.ts`
 * dentro de `STATUS_BY_CODE`.
 *
 * `CLIENT_NOT_FOUND` se usa también desde `ClientAccessGuard` cuando
 * un usuario sin acceso intenta tocar un cliente — devolvemos 404 (no
 * 403) para no leak existencia (D-mapi-024).
 */
export class ClientNotFoundError extends DomainError {
  readonly code = 'CLIENT_NOT_FOUND'
  constructor(clientId: string) {
    super(`Cliente no encontrado: ${clientId}`)
  }
}
