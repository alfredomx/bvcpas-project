# 10-bridge-client — WebSocket client + auth con mapi

**App:** kiro
**Status:** ✅ v0.2.0 (WS client + execute_fetch) y v0.3.0 (login JWT en popup + list_tabs) cerradas y verificadas en vivo.
**Backend asociado:** [`apps/mapi/roadmap/23-plugin-bridge`](../../../mapi/roadmap/23-plugin-bridge/README.md)
**Última revisión:** 2026-06-13

> Corrige la referencia vieja (`20-intuit/02-bridge`): el backend es `23-plugin-bridge`, genérico.

## Por qué existe este bloque

El plugin `kiro` es el **comunicador** Chrome↔backend. Este bloque construye el lado cliente del
canal: se conecta por WebSocket a mapi, se autentica, recibe comandos y los **despacha al ejecutor**
(`21-fetch-executor`, ya construido), y devuelve la respuesta correlacionada. Toda la lógica de
bancos vive en mapi (Design B); kiro solo transporta y ejecuta.

## Alcance (v0.2.0)

### Sí entra

- **WebSocket client en el service worker** (`background.ts`). Conecta a `BRIDGE_URL`
  (`ws://localhost:4000/bridge` local · `wss://mapi.kodapp.com.mx/bridge` prod).
- **Auth shared secret**: al conectar manda `{ type:'hello', secret, clientInfo }`; `secret` viene
  de `chrome.storage.local` (configurable desde el popup). Mismo valor que `BRIDGE_SECRET` en mapi.
- **Reconnect con backoff exponencial** + **keepalive MV3** (`chrome.alarms` para revivir el SW y
  reconectar; mantener el SW vivo mientras hay comando en vuelo).
- **Dispatch**: al recibir `{ type:'execute_fetch'|'check_session', correlationId, payload }`:
  1. parsea/valida a `BridgeCommand` (tipos de `21-fetch-executor`),
  2. rutea `execute_fetch` al content script de la pestaña correcta vía `chrome.tabs.sendMessage`
     (el `fetch` debe correr same-origin en la pestaña del banco); `check_session` corre en el SW,
  3. `await handleBridgeCommand(command)`,
  4. responde `{ type:'result', correlationId, payload }` por el mismo socket.
- Estado de sesión en `chrome.storage.local` (último ping, conectado sí/no).

### NO entra

- Lógica de bancos (vive en mapi). UI compleja (popup minimal). Migración a JWT (diferida, BACKLOG).

## Permisos Chrome

- `storage` (secret + estado), `alarms` (keepalive), `tabs` (rutear al content script), `scripting`.
- `host_permissions`: mapi (`wss`) + **`<all_urls>`** (decidido: el plugin opera donde mapi diga; la
  config de servicios vive en mapi, no aquí). Distribución privada/demo → `<all_urls>` required.

## Pre-requisitos

- ✅ P0 (scaffold). ✅ `21-fetch-executor` (executor + tests, hecho).
- ⏳ Backend `23-plugin-bridge` (gateway) — acoplado, se prueba junto (mapi v0.17.0).

## Decisiones (D-kiro-NNN)

| ID         | Decisión                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-kiro-B01 | Transporte WS, kiro es cliente; auth shared secret (JWT diferido)                                                                                            |
| D-kiro-B02 | `<all_urls>` required; sin config de servicios en el plugin (mapi dueño)                                                                                     |
| D-kiro-B03 | `execute_fetch` se rutea al content script (same-origin/cookies); `check_session` en el SW                                                                   |
| D-kiro-B04 | Keepalive MV3 con `chrome.alarms` + reconnect backoff                                                                                                        |
| D-kiro-B05 | `correlationId` (transporte) → `requestId` (`FetchInstruction`); kiro lo inyecta porque el payload de mapi no lo trae                                        |
| D-kiro-B06 | `execute_fetch` se rutea por **origin** de la URL; sin pestaña same-origin → `result` con `{ error }` (no rompe socket)                                      |
| D-kiro-B07 | Content script se compila aparte como IIFE auto-contenido (`vite.content.config.ts`); SW/popup quedan en el build ESM principal                              |
| D-kiro-B08 | Comando desconocido/JSON inválido → `console.warn`, sin cerrar el socket ni responder                                                                        |
| D-kiro-B09 | Mensaje interno SW→content `{ kind:'kiro:execute_fetch', correlationId, payload }`; content responde `FetchResult` por `sendResponse` (async, `return true`) |

## Nota MV3 (riesgo conocido)

El SW se duerme ~30s en idle → el WS se cae estando inactivo. Mitigación: `chrome.alarms`
(mín ~30s) revive el SW y reconecta; mientras procesa un comando el SW se mantiene vivo. En el
flujo real el usuario está presente (dispara desde Claude) → SW despierto. Documentar limitación.

## Tests (Tipo A, Vitest + mocks de chrome/WebSocket)

- Al conectar manda `hello` con el secret de storage.
- Reconnect con backoff tras caída.
- Dispatch: `execute_fetch` rutea a `chrome.tabs.sendMessage`; `result` se envía correlacionado por `correlationId`.
- Comando desconocido → no rompe el socket (loguea / responde error).

## Versiones

| Versión | Estado | Tema                                                                                                          |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| 0.2.0   | ✅     | WS client + auth + reconnect/keepalive + dispatch a `21-fetch-executor` — verificado en vivo con mapi v0.17.0 |
| 0.3.0   | ✅     | Login JWT en el popup (dos pantallas, inglés, logout) + `list_tabs` stateless — espejo de mapi v0.19.0        |
