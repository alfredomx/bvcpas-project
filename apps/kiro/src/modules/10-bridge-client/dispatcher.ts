// Dispatcher de comandos entrantes del bridge.
//
// Reglas (D-kiro-B03):
//  - `check_session` corre en el SERVICE WORKER: el SW tiene acceso a
//    `chrome.tabs.query`, no necesita same-origin. Llama directo a
//    `handleBridgeCommand`.
//  - `execute_fetch` debe correr en el CONTENT SCRIPT de la pestaña del banco
//    (same-origin → el navegador adjunta cookies de sesión, incluso HttpOnly).
//    El SW localiza la pestaña cuyo origin coincide con el `url` del fetch y le
//    rutea el comando vía `chrome.tabs.sendMessage`. El content script corre
//    `executeFetch` y devuelve el `FetchResult`.
//
// El SW NO puede correr `executeFetch` directamente porque sus cookies no son
// las de la pestaña del banco. De ahí el ruteo.

import { handleBridgeCommand } from '../21-fetch-executor'
import type { BridgeCommandResult } from '../21-fetch-executor/types'
import type { BridgeErrorPayload, IncomingCommandMessage, RoutedFetchMessage } from './types'

/** Resultado del dispatch: el payload que se devuelve por el `result`. */
export type DispatchResult = BridgeCommandResult | BridgeErrorPayload

/**
 * Encuentra el id de una pestaña cuyo origin coincide con el de `targetUrl`.
 * Devuelve null si la URL es inválida o no hay pestaña same-origin abierta.
 */
async function findTabForUrl(targetUrl: string): Promise<number | null> {
  let targetOrigin: string
  try {
    targetOrigin = new URL(targetUrl).origin
  } catch {
    return null
  }

  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue
    let tabOrigin: string
    try {
      tabOrigin = new URL(tab.url).origin
    } catch {
      continue
    }
    if (tabOrigin === targetOrigin) return tab.id
  }
  return null
}

/**
 * Despacha un comando entrante y devuelve el payload del `result`.
 * Nunca lanza: ante error devuelve `{ error }` para que el caller responda
 * un `result` con el error en vez de romper el socket.
 */
export async function dispatchCommand(command: IncomingCommandMessage): Promise<DispatchResult> {
  try {
    if (command.type === 'check_session') {
      // Corre en el SW: no necesita same-origin.
      return await handleBridgeCommand({
        type: 'check_session',
        instruction: { bank: command.payload.bank },
      })
    }

    // execute_fetch → rutear al content script de la pestaña same-origin.
    const tabId = await findTabForUrl(command.payload.url)
    if (tabId === null) {
      return {
        error: `no hay pestaña same-origin abierta para ${command.payload.url}`,
      }
    }

    const routed: RoutedFetchMessage = {
      kind: 'kiro:execute_fetch',
      correlationId: command.correlationId,
      payload: command.payload,
    }

    // El content script corre `executeFetch` y responde con el FetchResult.
    const response = (await chrome.tabs.sendMessage(tabId, routed)) as
      | BridgeCommandResult
      | undefined
    if (!response) {
      return { error: 'el content script no respondió (pestaña sin content script cargado?)' }
    }
    return response
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
