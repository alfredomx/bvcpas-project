// Cliente HTTP base para hablar con mapi.
//
// Reglas (ver TDD v0.2.0 / D-bvcpas-001):
// - Wrapper sobre fetch nativo, sin deps externas.
// - Lee NEXT_PUBLIC_API_URL para baseURL.
// - Inyecta `Authorization: Bearer <token>` si hay token en sessionStorage.
// - Si response no es 2xx, parsea `{ statusCode, code, message }` y lanza ApiError.
// - 401 en endpoints distintos de /v1/auth/login dispara evento DOM
//   `auth:unauthorized` para que (authenticated)/layout.tsx cierre sesión global.

const ACCESS_TOKEN_KEY = 'bvcpas.accessToken'
const LOGIN_PATH = '/v1/auth/login'

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
  }
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

function buildUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined')
  }
  // Path siempre arranca con `/`. base puede o no traer `/` final.
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalizedBase}${path}`
}

function dispatchUnauthorized(path: string): void {
  if (typeof window === 'undefined') return
  if (path === LOGIN_PATH) return // login fallido NO cierra sesión global
  window.dispatchEvent(new Event('auth:unauthorized'))
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const token = readToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

  let payload: unknown = null
  const text = await response.text()
  if (text.length > 0) {
    try {
      payload = JSON.parse(text)
    } catch {
      // Respuesta no-JSON. Tratar como error si no es 2xx.
      payload = { message: text }
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      dispatchUnauthorized(path)
    }
    const errorPayload = (payload ?? {}) as { code?: string; message?: string }
    throw new ApiError(
      response.status,
      errorPayload.code ?? 'UNKNOWN_ERROR',
      errorPayload.message ?? `Request failed with status ${response.status}`,
    )
  }

  return payload as T
}

export function httpGet<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function httpPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body ?? {})
}

export function httpPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body ?? {})
}

export function httpDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path)
}
