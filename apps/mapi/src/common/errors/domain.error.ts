/**
 * Clase base para errores de dominio. Cada módulo extiende DomainError con
 * un `code` específico (CLIENT_NOT_FOUND, INTUIT_TOKEN_EXPIRED, etc.) que
 * el filter mapea a un HTTP status.
 *
 * Sin try/catch genérico: el filter global atrapa estos errores y los
 * convierte a la respuesta JSON estándar.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}
