import { DomainError } from '@/common/errors/domain.error'

/** El `:id` pedido no existe en `clients`. */
export class ClientNotFoundError extends DomainError {
  readonly code = 'CLIENT_NOT_FOUND'
  readonly status = 404
  constructor(id: string) {
    super(`Cliente ${id} no encontrado`, { id })
  }
}
