// Content script de ejecución (kiro 10-bridge-client).
//
// Se inyecta en `<all_urls>` (ver manifest). Su único trabajo: recibir un
// `execute_fetch` ruteado por el service worker vía `chrome.tabs.sendMessage`,
// correr `executeFetch` SAME-ORIGIN en la pestaña (de modo que el navegador
// adjunte las cookies de sesión, incluso HttpOnly) y devolver el `FetchResult`.
//
// El content script NO conoce el WebSocket ni el protocolo del bridge. Solo
// ejecuta el fetch que el SW le rutea y responde. El SW reenvía ese resultado
// a mapi correlacionado por `correlationId`.

import { executeFetch } from '../21-fetch-executor'
import { executeDom } from '../22-dom-executor'
import type { RoutedDomMessage, RoutedFetchMessage } from './types'

/** Type guard del mensaje ruteado por el SW. */
export function isRoutedFetchMessage(msg: unknown): msg is RoutedFetchMessage {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return (
    m.kind === 'kiro:execute_fetch' &&
    typeof m.correlationId === 'string' &&
    !!m.payload &&
    typeof m.payload === 'object'
  )
}

/** Type guard del mensaje ruteado de una receta DOM. */
export function isRoutedDomMessage(msg: unknown): msg is RoutedDomMessage {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return (
    m.kind === 'kiro:execute_dom' &&
    typeof m.correlationId === 'string' &&
    !!m.payload &&
    typeof m.payload === 'object'
  )
}

/**
 * Handler del mensaje ruteado. Corre `executeFetch` con `requestId` =
 * `correlationId` (mismo concepto) y llama `sendResponse` con el resultado.
 * Devuelve `true` para mantener el canal abierto (respuesta asíncrona), como
 * exige la API de `chrome.runtime.onMessage`.
 */
export function handleRoutedMessage(
  msg: unknown,
  _sender: unknown,
  sendResponse: (response: unknown) => void,
): boolean {
  if (isRoutedFetchMessage(msg)) {
    void executeFetch({
      requestId: msg.correlationId,
      method: msg.payload.method as never,
      url: msg.payload.url,
      headers: msg.payload.headers,
      body: msg.payload.body,
    }).then(sendResponse)
    return true // respuesta asíncrona
  }

  if (isRoutedDomMessage(msg)) {
    void executeDom({
      requestId: msg.correlationId,
      steps: msg.payload.steps,
    }).then(sendResponse)
    return true // respuesta asíncrona
  }

  return false
}

/** Registra el listener en el content script. Llamado al cargar (no en tests). */
export function registerContentListener(): void {
  chrome.runtime.onMessage.addListener(handleRoutedMessage)
}
