/**
 * Tipos del transporte de fetch para adapters bancarios (Design B).
 *
 * El adapter (lógica del banco, server-side) no conoce WebSocket: pide un
 * `fetch` a un `BankFetchExecutor`, que lo despacha al plugin (kiro) vía el
 * bridge. El plugin ejecuta el `fetch` en la sesión viva del banco y devuelve
 * el `FetchResult`. Reemplaza el `page.request.fetch` de Playwright del proyecto
 * original.
 */

/** Verbos HTTP que un adapter puede pedir. */
export type BankHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Petición de fetch que el adapter arma (URL/headers/body los dicta el adapter). */
export interface BankFetchRequest {
  method: BankHttpMethod
  /** URL absoluta del banco (ej. https://secure.chase.com/svc/...). */
  url: string
  headers?: Record<string, string>
  /** Body ya serializado (ej. URLSearchParams.toString()). */
  body?: string
}

/** Cómo viene serializado el body de la respuesta. */
export type BankBodyEncoding = 'text' | 'base64'

/**
 * Respuesta cruda del fetch ejecutado por el plugin. Mismo shape que el
 * `FetchResult` de kiro (`21-fetch-executor`). El body es texto (JSON/CSV) o
 * base64 (binario: PDF) según el `content-type`.
 */
export interface FetchResult {
  /** true si la red respondió 2xx; false en error de red o no-2xx. */
  ok: boolean
  /** Status HTTP. 0 en error de red. */
  status: number
  /** Headers de la respuesta (lowercased). */
  headers: Record<string, string>
  /** Body serializado. Vacío en error de red. */
  body: string
  bodyEncoding: BankBodyEncoding
  /** Mensaje de error en fallo de red (ausente si hubo status). */
  error?: string
}

/**
 * Ejecutor de fetches del adapter. Implementación real: `BridgeFetchExecutor`
 * (sobre `BridgeCommandService`). En tests: un mock con respuestas canned.
 */
export interface BankFetchExecutor {
  fetch(req: BankFetchRequest): Promise<FetchResult>
}
