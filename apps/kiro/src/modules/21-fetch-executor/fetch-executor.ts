// Ejecutor de fetch genérico (Design B).
//
// Este archivo es el corazón del módulo: corre un `fetch` arbitrario y devuelve
// la respuesta cruda. NO conoce bancos, ni URLs, ni mecánica de tokens — todo
// eso lo dicta mapi vía bridge. Mantenerlo así protege el moat: quien reversee
// el plugin encuentra un ejecutor tonto, no la lógica de bancos.
//
// Contexto de ejecución: este código corre en el content script de la pestaña
// del banco (same-origin), de modo que el navegador adjunta solas las cookies
// de sesión (incluso HttpOnly). Por eso se usa `credentials: 'include'`.

import type {
  CheckSessionInstruction,
  CheckSessionResult,
  FetchInstruction,
  FetchResult,
} from './types'

/**
 * Decide si un content-type se serializa como texto o como base64.
 * Texto: JSON, XML, y cualquier `text/*`. Resto (PDF, imágenes, octet-stream,
 * o content-type ausente) → base64, que es seguro para binario.
 */
function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const ct = contentType.toLowerCase()
  return (
    ct.startsWith('text/') ||
    ct.includes('application/json') ||
    ct.includes('application/xml') ||
    ct.includes('+json') ||
    ct.includes('+xml') ||
    ct.includes('application/x-www-form-urlencoded') ||
    ct.includes('application/javascript')
  )
}

/** Convierte un ArrayBuffer a base64 sin depender de Buffer (Node) — usa btoa. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Chunk para no reventar el call stack con archivos grandes.
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/** Serializa los headers de una Response a un objeto plano. */
function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

/**
 * Ejecuta una orden de fetch genérica y devuelve la respuesta correlacionada
 * por `requestId`. Nunca lanza: ante error de red devuelve `ok:false`,
 * `status:0` y `error`. Ante respuesta no-2xx devuelve `ok:false` con el status
 * y el body reales.
 */
export async function executeFetch(instruction: FetchInstruction): Promise<FetchResult> {
  const { requestId, method, url, headers, body } = instruction

  const init: RequestInit = {
    method,
    // Same-origin en el content script de la pestaña → adjunta cookies de sesión.
    credentials: 'include',
  }
  if (headers) init.headers = headers
  if (body !== undefined) init.body = body

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    return {
      requestId,
      ok: false,
      status: 0,
      headers: {},
      body: '',
      bodyEncoding: 'text',
      error: err instanceof Error ? err.message : String(err),
    }
  }

  const responseHeaders = headersToObject(response.headers)
  const contentType = response.headers.get('content-type')

  let serializedBody: string
  let bodyEncoding: FetchResult['bodyEncoding']
  if (isTextContentType(contentType)) {
    serializedBody = await response.text()
    bodyEncoding = 'text'
  } else {
    const buffer = await response.arrayBuffer()
    serializedBody = arrayBufferToBase64(buffer)
    bodyEncoding = 'base64'
  }

  return {
    requestId,
    ok: response.ok,
    status: response.status,
    headers: responseHeaders,
    body: serializedBody,
    bodyEncoding,
  }
}

/**
 * Extrae el host de una URL. Devuelve null si la URL no es parseable.
 */
function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * ¿El host de una pestaña corresponde al dominio pedido? Match por igualdad o
 * por subdominio real (`secure.example.com` cuenta para `example.com`), nunca
 * por substring (evita que `notexample.com` o `example.com.evil.org` cuelen).
 */
function hostMatchesDomain(host: string, domain: string): boolean {
  const d = domain.toLowerCase()
  return host === d || host.endsWith(`.${d}`)
}

/**
 * Heurística simple de sesión: ¿hay alguna pestaña abierta cuyo dominio
 * coincide con `bank`? El dominio lo dicta quien llama (mapi) — el plugin NO
 * hardcodea dominios bancarios.
 *
 * Nota: esto solo detecta presencia de pestaña, no valida la sesión activa
 * (eso lo confirma mapi mandando un `execute_fetch` de prueba que no redirija
 * a login). Ver punto de integración en bridge-handler.ts.
 */
export async function checkSession(
  instruction: CheckSessionInstruction,
): Promise<CheckSessionResult> {
  const { bank } = instruction
  const tabs = await chrome.tabs.query({})

  let tabCount = 0
  for (const tab of tabs) {
    const host = hostOf(tab.url)
    if (host && hostMatchesDomain(host, bank)) {
      tabCount += 1
    }
  }

  return {
    bank,
    authenticated: tabCount > 0,
    tabCount,
  }
}
