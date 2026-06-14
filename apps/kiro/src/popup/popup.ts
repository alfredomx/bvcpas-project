// Popup mínimo: configurar BRIDGE_URL + secret y ver estado de conexión.
// Suficiente para el smoke (D-kiro-B02: el plugin no tiene config de servicios;
// solo el transporte). El secret se guarda en chrome.storage.local.

import {
  readBridgeConfig,
  setBridgeSecret,
  setBridgeUrl,
  STORAGE_KEY_STATUS,
} from '../modules/10-bridge-client'
import type { BridgeStatus } from '../modules/10-bridge-client'

const urlInput = document.getElementById('url') as HTMLInputElement
const secretInput = document.getElementById('secret') as HTMLInputElement
const saveBtn = document.getElementById('save') as HTMLButtonElement
const reconnectBtn = document.getElementById('reconnect') as HTMLButtonElement
const statusEl = document.getElementById('status') as HTMLDivElement

async function renderStatus(): Promise<void> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_STATUS])
  const status = stored[STORAGE_KEY_STATUS] as BridgeStatus | undefined
  if (!status) {
    statusEl.textContent = 'Estado: desconocido'
    statusEl.className = ''
    return
  }
  if (status.connected) {
    statusEl.textContent = 'Conectado'
    statusEl.className = 'ok'
  } else {
    statusEl.textContent = `Desconectado${status.lastError ? ` — ${status.lastError}` : ''}`
    statusEl.className = 'off'
  }
}

async function init(): Promise<void> {
  const config = await readBridgeConfig()
  urlInput.value = config.bridgeUrl
  secretInput.value = config.secret
  await renderStatus()
}

saveBtn.addEventListener('click', () => {
  void (async () => {
    await setBridgeUrl(urlInput.value.trim())
    await setBridgeSecret(secretInput.value.trim())
    statusEl.textContent = 'Guardado. Reconectando…'
    statusEl.className = ''
    // El SW reconecta al próximo alarm; pide reconexión inmediata.
    chrome.runtime.sendMessage({ kind: 'kiro:reconnect' }).catch(() => {
      /* el SW puede estar dormido; el alarm reconectará */
    })
  })()
})

reconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ kind: 'kiro:reconnect' }).catch(() => {
    /* noop */
  })
  void renderStatus()
})

void init()
