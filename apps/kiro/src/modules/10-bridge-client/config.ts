// Config del bridge cliente: lee `bridge_secret` y `bridge_url` de
// `chrome.storage.local`. Provee defaults para el smoke local.
//
// El secret se setea desde el popup (ver popup.ts) o con un helper. NO se
// hardcodea ningún dominio de banco aquí — eso es de mapi.

import type { BridgeClientConfig } from './types'

/** Clave de storage para el shared secret. */
export const STORAGE_KEY_SECRET = 'bridge_secret'
/** Clave de storage para la URL del bridge. */
export const STORAGE_KEY_URL = 'bridge_url'
/** Clave de storage donde se persiste el estado de conexión. */
export const STORAGE_KEY_STATUS = 'bridge_status'

/** URL por defecto del bridge en desarrollo local. */
export const DEFAULT_BRIDGE_URL = 'ws://localhost:4000/bridge'

/**
 * Lee la config del bridge de `chrome.storage.local`.
 * - `bridgeUrl`: usa el guardado, o `DEFAULT_BRIDGE_URL` si no hay.
 * - `secret`: cadena vacía si no se ha configurado (el `hello` fallará y mapi
 *   cerrará la conexión — comportamiento esperado hasta que el operador lo setee).
 */
export async function readBridgeConfig(): Promise<BridgeClientConfig> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_SECRET, STORAGE_KEY_URL])
  const secret = typeof stored[STORAGE_KEY_SECRET] === 'string' ? stored[STORAGE_KEY_SECRET] : ''
  const bridgeUrl =
    typeof stored[STORAGE_KEY_URL] === 'string' && stored[STORAGE_KEY_URL]
      ? stored[STORAGE_KEY_URL]
      : DEFAULT_BRIDGE_URL
  return { bridgeUrl, secret }
}

/** Setea el shared secret en storage (útil desde el popup o un helper). */
export async function setBridgeSecret(secret: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_SECRET]: secret })
}

/** Setea la URL del bridge en storage (sobreescribe el default). */
export async function setBridgeUrl(bridgeUrl: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_URL]: bridgeUrl })
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
