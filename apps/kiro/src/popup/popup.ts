// Popup: two states.
//  - Logged out: BRIDGE URL + email + password + Login.
//  - Logged in:  greeting "Hello, <name>" + connection status + Reconnect + Logout.
//
// v0.19.0: the bridge authenticates with the operator's JWT (no shared secret).
// The JWT is cached in chrome.storage.local; the password is never persisted.
// UI strings in English.

import {
  readBridgeConfig,
  loginToMapi,
  saveOperatorSession,
  readOperatorSession,
  clearOperatorSession,
  setBridgeUrl,
  STORAGE_KEY_STATUS,
} from '../modules/10-bridge-client'
import type { BridgeStatus } from '../modules/10-bridge-client'

const urlInput = document.getElementById('url') as HTMLInputElement
const emailInput = document.getElementById('email') as HTMLInputElement
const passwordInput = document.getElementById('password') as HTMLInputElement
const loginBtn = document.getElementById('login') as HTMLButtonElement
const reconnectBtn = document.getElementById('reconnect') as HTMLButtonElement
const logoutBtn = document.getElementById('logout') as HTMLButtonElement
const loginView = document.getElementById('login-view') as HTMLDivElement
const appView = document.getElementById('app-view') as HTMLDivElement
const greetingEl = document.getElementById('greeting') as HTMLParagraphElement
const statusEl = document.getElementById('status') as HTMLDivElement

function setStatus(text: string, cls: '' | 'ok' | 'off' = ''): void {
  statusEl.textContent = text
  statusEl.className = cls
}

async function renderStatus(): Promise<void> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_STATUS])
  const status = stored[STORAGE_KEY_STATUS] as BridgeStatus | undefined
  if (!status) return setStatus('Status: unknown')
  if (status.connected) return setStatus('Connected', 'ok')
  setStatus(`Disconnected${status.lastError ? ` — ${status.lastError}` : ''}`, 'off')
}

function showLoggedIn(name: string): void {
  loginView.hidden = true
  appView.hidden = false
  greetingEl.textContent = `Hello, ${name}`
}

function showLoggedOut(): void {
  appView.hidden = true
  loginView.hidden = false
  passwordInput.value = ''
}

async function init(): Promise<void> {
  const config = await readBridgeConfig()
  urlInput.value = config.bridgeUrl
  const session = await readOperatorSession()
  if (session.token) {
    showLoggedIn(session.name || 'operator')
    await renderStatus()
  } else {
    showLoggedOut()
  }
}

loginBtn.addEventListener('click', () => {
  void (async () => {
    const bridgeUrl = urlInput.value.trim()
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!bridgeUrl || !email || !password) {
      setStatus('URL, email and password are required', 'off')
      return
    }
    setStatus('Logging in…')
    try {
      await setBridgeUrl(bridgeUrl)
      const session = await loginToMapi(bridgeUrl, email, password)
      await saveOperatorSession(session)
      passwordInput.value = ''
      showLoggedIn(session.name || email)
      setStatus('Login OK. Connecting…')
      // The SW (re)connects with the fresh JWT.
      chrome.runtime.sendMessage({ kind: 'kiro:reconnect' }).catch(() => {
        /* SW may be asleep; the keepalive alarm will connect */
      })
    } catch (err) {
      setStatus(`Login failed: ${err instanceof Error ? err.message : String(err)}`, 'off')
    }
  })()
})

logoutBtn.addEventListener('click', () => {
  void (async () => {
    await clearOperatorSession()
    chrome.runtime.sendMessage({ kind: 'kiro:logout' }).catch(() => {
      /* SW may be asleep; it will start logged-out on next wake */
    })
    showLoggedOut()
    setStatus('Logged out')
  })()
})

// Reconnect: force an immediate reconnect. Useful when the MV3 service worker
// has gone to sleep (the WS drops on idle) and you want to connect now instead
// of waiting for the keepalive alarm (~30s).
reconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ kind: 'kiro:reconnect' }).catch(() => {
    /* noop */
  })
  void renderStatus()
})

void init()
