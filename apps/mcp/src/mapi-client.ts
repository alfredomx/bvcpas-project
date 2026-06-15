/**
 * Cliente HTTP delgado a mapi. Una sola responsabilidad: armar la request con el
 * Bearer admin, parsear la respuesta y normalizar el error a algo legible para el tool.
 * NO tiene lógica de negocio — eso vive en mapi.
 */

export type FetchFn = typeof fetch

export interface MapiClientConfig {
  baseUrl: string
  jwt: string
  /** Inyectable para tests (default: fetch global). */
  fetchFn?: FetchFn
}

/** Error de mapi ya normalizado (status + mensaje + payload crudo por si sirve). */
export class MapiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message)
    this.name = 'MapiError'
  }
}

export class MapiClient {
  constructor(private readonly cfg: MapiClientConfig) {}

  private get f(): FetchFn {
    return this.cfg.fetchFn ?? fetch
  }

  /** Hace la request a `${baseUrl}${path}`. Lanza MapiError si !ok. */
  async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.cfg.jwt}` }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const res = await this.f(`${this.cfg.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    const text = await res.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = text
      }
    }

    if (!res.ok) {
      throw new MapiError(res.status, extractMessage(json, res.status), json)
    }
    return json
  }

  get(path: string): Promise<unknown> {
    return this.request('GET', path)
  }

  post(path: string, body: unknown): Promise<unknown> {
    return this.request('POST', path, body)
  }
}

/** Saca el mensaje más útil del cuerpo de error de mapi (DomainErrorFilter usa `message`). */
function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    const msg = b.message ?? b.error
    if (typeof msg === 'string') return `mapi ${status}: ${msg}`
  }
  if (typeof body === 'string' && body) return `mapi ${status}: ${body}`
  return `mapi ${status}`
}
