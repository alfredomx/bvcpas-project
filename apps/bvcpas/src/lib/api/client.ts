// Cliente HTTP tipado generado desde el OpenAPI de mapi.
//
// Stack:
//   - `openapi-fetch` runtime: envuelve fetch nativo y devuelve
//     `{ data, error }` con tipos inferidos desde `paths`.
//   - `openapi-typescript` (devDep) genera `./schema.ts` desde
//     `https://dev.alfredo.mx/v1/docs-json` vía `npm run sdk:gen`.
//
// Middlewares (espejo funcional de `@/lib/http.ts`):
//   1. auth — inyecta `Authorization: Bearer <token>` leyendo
//      sessionStorage (key `bvcpas.accessToken`, misma que usa http.ts).
//   2. unauthorized — en 401 a paths != /v1/auth/login dispara
//      `window.dispatchEvent(new Event('auth:unauthorized'))` para que
//      `(authenticated)/layout.tsx` cierre sesión global.
//
// v0.3.2 (D-bvcpas-024): coexiste con `@/lib/http.ts`. La migración +
// borrado de http.ts entra en v0.3.3.

import createClient, { type Middleware } from 'openapi-fetch'

import type { paths } from './schema'

const ACCESS_TOKEN_KEY = 'bvcpas.accessToken'
const LOGIN_PATH = '/v1/auth/login'

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = readToken()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
}

const unauthorizedMiddleware: Middleware = {
  onResponse({ request, response }) {
    if (response.status !== 401) return
    if (typeof window === 'undefined') return
    // El path completo viene en request.url; comparamos contra el
    // pathname para evitar falsos positivos por query string.
    let pathname: string
    try {
      pathname = new URL(request.url).pathname
    } catch {
      pathname = request.url
    }
    if (pathname.endsWith(LOGIN_PATH)) return
    window.dispatchEvent(new Event('auth:unauthorized'))
  },
}

export const api = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
})

api.use(authMiddleware, unauthorizedMiddleware)
