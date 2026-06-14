// Service worker (Manifest v3) — kiro.
//
// Arranca el cliente WebSocket del bridge (10-bridge-client): conecta a mapi,
// se autentica con el secret de storage, despacha comandos entrantes y
// reconecta con backoff. El keepalive (`chrome.alarms`) revive el SW dormido y
// vuelve a conectar (limitación MV3 documentada en bridge-client.ts).

import {
  BridgeClient,
  ensureKeepaliveAlarm,
  KEEPALIVE_ALARM,
  readBridgeConfig,
} from './modules/10-bridge-client'
import type { ClientInfo } from './modules/10-bridge-client'

let client: BridgeClient | null = null

/** Construye la info del cliente para el `hello`. */
function buildClientInfo(): ClientInfo {
  const version = chrome.runtime.getManifest().version
  return { version, userAgent: navigator.userAgent }
}

/**
 * Asegura que exista un BridgeClient conectado. Idempotente: si ya hay uno,
 * solo (re)conecta. Lee la config fresca de storage cada vez (el JWT/URL
 * pueden haber cambiado desde el popup).
 *
 * Sin JWT (operador no logueado o tras logout) NO conecta: el `hello` fallaría
 * y mapi cerraría el socket. Espera a que el popup haga login.
 */
async function startOrReconnectBridge(): Promise<void> {
  const config = await readBridgeConfig()
  if (!config.token) {
    if (client) {
      client.disconnect()
      client = null
    }
    return
  }
  if (!client) {
    client = new BridgeClient(config, { clientInfo: buildClientInfo() })
  }
  client.connect()
}

// Arranque al instalar / actualizar.
chrome.runtime.onInstalled.addListener(() => {
  console.log('[kiro] service worker installed')
  ensureKeepaliveAlarm()
  void startOrReconnectBridge()
})

// Arranque al despertar el SW (MV3 lo recrea desde cero al recibir un evento).
chrome.runtime.onStartup.addListener(() => {
  ensureKeepaliveAlarm()
  void startOrReconnectBridge()
})

// Keepalive: el alarm revive el SW dormido y reconecta si hace falta.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    void startOrReconnectBridge()
  }
})

// Mensajes desde el popup.
chrome.runtime.onMessage.addListener((msg) => {
  const kind = msg && typeof msg === 'object' ? (msg as { kind?: string }).kind : undefined

  if (kind === 'kiro:reconnect') {
    // El JWT/URL pudo cambiar (login) → recrear el cliente con la config fresca.
    // IMPORTANTE: apagar el cliente anterior (cierra su socket y cancela su
    // reconnect) ANTES de nulificarlo. Si solo se hace `client = null`, el
    // cliente viejo queda zombi: sigue reconectando con la config vieja en
    // paralelo al nuevo.
    if (client) client.disconnect()
    client = null
    void startOrReconnectBridge()
    return
  }

  if (kind === 'kiro:logout') {
    // Logout: cerrar la conexión y NO reconectar (ya no hay JWT en storage).
    if (client) client.disconnect()
    client = null
  }
})

// Conexión inicial al cargar el módulo del SW.
ensureKeepaliveAlarm()
void startOrReconnectBridge()
