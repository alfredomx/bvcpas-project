// Config del bridge cliente: lee `bridge_jwt` y `bridge_url` de
// `chrome.storage.local`. Provee defaults para el smoke local.
//
// v0.19.0: el bridge se autentica con el JWT del operador (login a mapi), ya
// no con un shared secret. El JWT se obtiene desde el popup (login) y se cachea.
// NO se hardcodea ningún dominio de banco aquí — eso es de mapi.

import type { BridgeClientConfig } from './types'

/** Clave de storage para el JWT del operador. */
export const STORAGE_KEY_TOKEN = 'bridge_jwt'
/** Clave de storage para el nombre del operador logueado (para el saludo del popup). */
export const STORAGE_KEY_NAME = 'bridge_user_name'
/** Clave de storage para la URL del bridge. */
export const STORAGE_KEY_URL = 'bridge_url'
/** Clave de storage donde se persiste el estado de conexión. */
export const STORAGE_KEY_STATUS = 'bridge_status'

/** URL por defecto del bridge en desarrollo local. */
export const DEFAULT_BRIDGE_URL = 'ws://localhost:4000/bridge'

/**
 * Lee la config del bridge de `chrome.storage.local`.
 * - `bridgeUrl`: usa el guardado, o `DEFAULT_BRIDGE_URL` si no hay.
 * - `token`: cadena vacía si no se ha logueado (el `hello` fallará y mapi
 *   cerrará la conexión — esperado hasta que el operador haga login en el popup).
 */
export async function readBridgeConfig(): Promise<BridgeClientConfig> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_URL])
  const token = typeof stored[STORAGE_KEY_TOKEN] === 'string' ? stored[STORAGE_KEY_TOKEN] : ''
  const bridgeUrl =
    typeof stored[STORAGE_KEY_URL] === 'string' && stored[STORAGE_KEY_URL]
      ? stored[STORAGE_KEY_URL]
      : DEFAULT_BRIDGE_URL
  return { bridgeUrl, token }
}

/** Setea el JWT del operador en storage (lo llama el popup tras el login). */
export async function setBridgeToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: token })
}

/** Setea la URL del bridge en storage (sobreescribe el default). */
export async function setBridgeUrl(bridgeUrl: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_URL]: bridgeUrl })
}

/**
 * Deriva la base HTTP de mapi desde la URL del bridge (WS).
 * `ws://localhost:4000/bridge` → `http://localhost:4000`
 * `wss://mapi.kodapp.com.mx/bridge` → `https://mapi.kodapp.com.mx`
 */
export function httpBaseFromBridgeUrl(bridgeUrl: string): string {
  const u = new URL(bridgeUrl)
  const protocol = u.protocol === 'wss:' ? 'https:' : 'http:'
  return `${protocol}//${u.host}`
}

/** Sesión del operador devuelta por el login: JWT + nombre para el saludo. */
export interface OperatorSession {
  token: string
  name: string
}

/**
 * Loguea al operador contra mapi (`POST /v1/auth/login`) y devuelve el JWT + el
 * nombre. Lanza si las credenciales son inválidas o mapi no responde.
 */
export async function loginToMapi(
  bridgeUrl: string,
  email: string,
  password: string,
  fetchFn: typeof fetch = fetch,
): Promise<OperatorSession> {
  const base = httpBaseFromBridgeUrl(bridgeUrl)
  const res = await fetchFn(`${base}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`login failed: HTTP ${res.status}`)
  }
  const data = (await res.json()) as { accessToken?: string; user?: { fullName?: string } }
  if (!data.accessToken) throw new Error('login response without accessToken')
  return { token: data.accessToken, name: data.user?.fullName ?? email }
}

/** Persiste la sesión del operador (JWT + nombre) tras un login OK. */
export async function saveOperatorSession(session: OperatorSession): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_TOKEN]: session.token,
    [STORAGE_KEY_NAME]: session.name,
  })
}

/** Lee la sesión del operador guardada (vacía si no hay login). */
export async function readOperatorSession(): Promise<OperatorSession> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_NAME])
  return {
    token: typeof stored[STORAGE_KEY_TOKEN] === 'string' ? stored[STORAGE_KEY_TOKEN] : '',
    name: typeof stored[STORAGE_KEY_NAME] === 'string' ? stored[STORAGE_KEY_NAME] : '',
  }
}

/** Borra la sesión del operador (logout). */
export async function clearOperatorSession(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY_TOKEN, STORAGE_KEY_NAME])
}

/** Estado de conexión que se persiste para que el popup/diagnóstico lo lea. */
export interface BridgeStatus {
  connected: boolean
  /** Epoch ms del último cambio de estado o último mensaje recibido. */
  lastPingAt: number | null
  /** Último error de conexión (mensaje), si lo hubo. */
  lastError?: string
}

/** Persiste el estado de conexión en `chrome.storage.local`. */
export async function writeBridgeStatus(status: BridgeStatus): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_STATUS]: status })
}
