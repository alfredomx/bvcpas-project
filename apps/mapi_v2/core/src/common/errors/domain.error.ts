/**
 * Clase base para errores de dominio.
 *
 * A diferencia de mapi (donde un mapa central `STATUS_BY_CODE` traducía cada
 * código a un HTTP status), en el CORE cada error **carga su propio `status`**.
 * Razón: el core es host de plugins y NUNCA conoce los códigos de un plugin
 * (D-core-001). Un mapa central obligaría al core a importar/saber los códigos
 * de cada plugin — exactamente lo que la arquitectura prohíbe. Aquí cada plugin
 * declara sus errores con su code + status, y el DomainErrorFilter los lee
 * directo, sin lookup.
 *
 * Uso (en un plugin):
 *   export class ClientNotFoundError extends DomainError {
 *     readonly code = 'CLIENT_NOT_FOUND'
 *     readonly status = 404
 *     constructor(id: string) {
 *       super(`Cliente ${id} no encontrado`, { id })
 *     }
 *   }
 */
export abstract class DomainError extends Error {
  /** Código estable y legible (CLIENT_NOT_FOUND, etc.). */
  abstract readonly code: string

  /** HTTP status con el que el filter responde este error. */
  abstract readonly status: number

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}
