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
import type { DomResult } from '../22-dom-executor/types'
import type {
  BridgeErrorPayload,
  IncomingCommandMessage,
  ListTabsResult,
  OpenTabResult,
  RoutedDomMessage,
  RoutedFetchMessage,
  TabInfo,
} from './types'

/** Resultado del dispatch: el payload que se devuelve por el `result`. */
export type DispatchResult =
  | BridgeCommandResult
  | ListTabsResult
  | DomResult
  | OpenTabResult
  | BridgeErrorPayload

/** Tope de espera para que una pestaña recién abierta termine de cargar. */
const OPEN_TAB_LOAD_TIMEOUT_MS = 30_000

/**
 * Lista las pestañas abiertas (corre en el SW). Devuelve la info cruda; mapi
 * filtra por host y decide cuál usar (el plugin no interpreta nada — D-mapi-B09).
 */
async function listTabs(): Promise<ListTabsResult> {
  const tabs = await chrome.tabs.query({})
  const mapped: TabInfo[] = tabs
    .filter((t): t is chrome.tabs.Tab & { id: number } => t.id !== undefined)
    .map((t) => ({
      tabId: t.id,
      url: t.url,
      title: t.title,
      active: t.active,
      windowId: t.windowId,
    }))
  return { tabs: mapped }
}

/**
 * Espera a que una pestaña termine de cargar (`status === 'complete'`) vía
 * `chrome.tabs.onUpdated`. Rechaza al vencer el timeout. Limpia el listener en
 * ambos casos. Corre en el SW, que sobrevive a la navegación de la pestaña.
 */
function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo): void => {
      if (settled || updatedTabId !== tabId || info.status !== 'complete') return
      settled = true
      cleanup()
      resolve()
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(
        new Error(`open_tab: timeout esperando la carga de la pestaña ${tabId} (${timeoutMs}ms)`),
      )
    }, timeoutMs)
    function cleanup(): void {
      chrome.tabs.onUpdated.removeListener(listener)
      clearTimeout(timer)
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

/**
 * Abre una pestaña nueva en `url` (corre en el SW con `chrome.tabs.create`) y
 * espera a que termine de cargar antes de responder. El SW vive afuera de la
 * pestaña, así que sobrevive a la navegación y sí puede contestar el `result`.
 * mapi la usa cuando no hay una pestaña del portal abierta; luego manda la receta
 * de login por `execute_dom` sobre el `tabId` devuelto.
 */
async function openTab(url: string): Promise<OpenTabResult> {
  const tab = await chrome.tabs.create({ url, active: true })
  if (tab.id === undefined) throw new Error('open_tab: chrome no devolvió un tabId')
  if (tab.status !== 'complete') {
    await waitForTabComplete(tab.id, OPEN_TAB_LOAD_TIMEOUT_MS)
  }
  return { tabId: tab.id, url }
}

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

    if (command.type === 'list_tabs') {
      // Corre en el SW: lista cruda de pestañas, mapi decide.
      return await listTabs()
    }

    if (command.type === 'open_tab') {
      // Corre en el SW: abre la pestaña y espera su carga (el SW sobrevive a la
      // navegación, el content script no). mapi luego usa el tabId con execute_dom.
      return await openTab(command.payload.url)
    }

    if (command.type === 'execute_dom') {
      // Rutea al content script de la pestaña objetivo (mapi pasa el tabId,
      // sacado de list_tabs). El content corre la receta y devuelve DomResult.
      const routedDom: RoutedDomMessage = {
        kind: 'kiro:execute_dom',
        correlationId: command.correlationId,
        payload: command.payload,
      }
      const domResponse = (await chrome.tabs.sendMessage(command.payload.tabId, routedDom)) as
        | DomResult
        | undefined
      if (!domResponse) {
        return {
          error: `el content script no respondió (pestaña ${command.payload.tabId} sin content script?)`,
        }
      }
      return domResponse
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
