# 00-foundation — Bootstrap del plugin Chrome (Vite + Manifest v3)

**App:** kiro
**Status:** ✅ Completo
**Versiones que lo construyen:** [v0.1.0](v0.1.0.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este módulo

`00-foundation` es la base del plugin `kiro`. No resuelve un problema del operador directamente — establece el scaffold mínimo de un Chrome extension Manifest v3 con build via Vite, cargable en `chrome://extensions/` con "Load unpacked". Sin este scaffold, no hay dónde montar los content scripts ni el service worker que después orquestarán los flujos de QBO.

Decisión consciente: arrancar **sin** permisos especiales (`host_permissions`, `storage`, `tabs`). Cada permiso requiere prompt de aceptación en cada reload del usuario cuando cambia, y meterlos antes de usarlos genera fricción durante desarrollo. Entran cuando la versión que los necesita los pida.

Lo que cambia con `00-foundation` listo:

- Hay un `kiro` que builda con `npm run build` y genera `dist/` cargable en Chrome.
- El popup muestra "Hello" estático — placeholder que confirma que el manifest se aceptó y el bundle corre.
- El service worker se registra y loggea al instalar.
- La carpeta `apps/kiro/` está integrada al tooling cross-app del repo.

---

## Alcance

### Sí entra

- Scaffold Chrome extension Manifest v3 con Vite 5 (`apps/kiro/`) cargable con "Load unpacked".
- `package.json` con `type: "module"`. Dev deps: vite 5, vite-plugin-static-copy, typescript-eslint 8, prettier 3, @types/chrome, @types/node.
- `tsconfig.json` con types `chrome`, `node`, `vite/client`.
- `vite.config.ts`: build a `dist/`, `emptyOutDir`, popup.html en raíz como input, background.ts como segundo entry, copia `manifest.json` con `viteStaticCopy`. Output sin minificación.
- `manifest.json` v3 mínimo: `action.default_popup=popup.html`, `background.service_worker=background.js (type: module)`. Sin permisos especiales.
- `popup.html` en raíz del app (no en `src/popup/`) para que vite emita `dist/popup.html` directo sin prefijo.
- `src/popup/popup.ts`: log placeholder.
- `src/background.ts`: service worker con `chrome.runtime.onInstalled` log placeholder.
- `eslint.config.mjs` flat config v9 con tseslint + prettier + `no-explicit-any: error`.
- `.prettierrc` consistente con raíz.

### NO entra

- WebSocket client conectándose al backend (entra cuando mapi tenga gateway `/v1/bridge`).
- Lógica de detección de QBO (content scripts).
- Storage de tokens (decisión heredada: BridgeSecretGuard del lado de mapi maneja auth; plugin no guarda tokens).
- Service worker que haga algo más que loguear.
- Popup con UI compleja.
- Permisos `host_permissions`, `storage`, `tabs` (entran cuando se usen).
- Publicación en Chrome Web Store.

---

## Naming visible al operador

Únicamente el copy estático del popup (`Hello`, `kiro 0.1.0 — scaffold inicial`). Placeholder hasta que el popup tenga UI real. Cualquier copy futuro (botones, mensajes, estados de cliente conectado) sí pasa por NAM-1 en el módulo correspondiente.

---

## Diseño técnico

### Permisos Chrome

Ninguno. Sin `permissions`, `host_permissions`, `optional_permissions`. Entran cuando una versión concreta los necesite (probablemente `1x-bridge-client` cuando entre WebSocket).

### Content scripts / service worker handlers

| Archivo              | Tipo           | Match URL | Qué hace                                                 |
| -------------------- | -------------- | --------- | -------------------------------------------------------- |
| `src/background.ts`  | Service worker | —         | Handler `chrome.runtime.onInstalled`, loguea al instalar |
| `src/popup/popup.ts` | Popup script   | (popup)   | `console.log` placeholder al cargar                      |

### Endpoints de mapi consumidos

Ninguno. v0.1.0 no se conecta al backend.

### Configuración / env vars

Ninguna. Las extensions Chrome no tienen `.env` runtime — la config se inyecta en build-time o se guarda en `chrome.storage` (entra con la primera versión que lo use).

### Dependencias externas

- **Chrome Web APIs** (`chrome.runtime`, `chrome.tabs`, etc.) vía `@types/chrome`.
- **vite 5** + **vite-plugin-static-copy** para build.

---

## Decisiones tomadas

Las 4 decisiones están en [v0.1.0.md](v0.1.0.md) y en el índice del [`README.md` raíz del roadmap](../README.md).

- D-kiro-001 — Vite 5 (no 7) por compatibilidad con `vite-plugin-static-copy` ESM-only.
- D-kiro-002 — `popup.html` en raíz de `apps/kiro/` (no en `src/popup/`) para que vite emita ruta limpia.
- D-kiro-003 — `package.json type: "module"` para que vite cargue config + plugins ESM.
- D-kiro-004 — Sin permisos especiales en v0.1.0 (`host_permissions`, `storage`, `tabs` entran después).

---

## Tareas

Todas cerradas en v0.1.0. Ver [v0.1.0.md](v0.1.0.md) para detalle.

- [x] Estructura `apps/kiro/src/popup/`.
- [x] `package.json` con `type: "module"` y stack mínimo.
- [x] `tsconfig.json` con types chrome + node.
- [x] `vite.config.ts` con `viteStaticCopy` para `manifest.json`.
- [x] `manifest.json` v3 con popup + background.
- [x] `popup.html` en raíz del app.
- [x] `src/popup/popup.ts` y `src/background.ts` placeholders.
- [x] Validar `npm run typecheck` + `build` produciendo `dist/` correcto.
- [x] Cargar manualmente en `chrome://extensions/` "Load unpacked" con éxito (popup "Hello" funcional, service worker registrado).

---

## Migración de datos

Ninguna. No hay extension previa desde la cual migrar.

---

## Smoke test del módulo

Todos pasados al cierre de v0.1.0:

- [x] `cd apps/kiro && npm run typecheck` OK.
- [x] `npm run build` genera `dist/` con `manifest.json`, `popup.html`, `popup/popup.js`, `background.js`.
- [x] Chrome carga la extension con "Load unpacked" sin errores.
- [x] Click en ícono de kiro → popup "Hello" visible.
- [x] Service worker registrado (`chrome://extensions/` → link "Service worker" abre DevTools).
- [x] `npm run lint` desde raíz orquesta kiro también y pasa.

---

## Notas

- **Reload en Chrome:** después de `npm run build`, en `chrome://extensions/` hacer click en "Reload" sobre la extension cargada. Sin reload, Chrome usa la versión cacheada anterior.
- **Versionado dual obligatorio al cierre:** cuando v0.2.0 entre, ambos `package.json` y `manifest.json` deben bumpear. Chrome Web Store rechaza versiones que no avancen monotónicamente.
- **No deployed.** El plugin se distribuye manualmente al operador (build local → "Load unpacked" en su Chrome). Publicación en Web Store está en BACKLOG con trigger.
- Numeración de módulos en `kiro` arrancará con un dominio funcional cuando se necesite (probablemente `1x-bridge-client` para WebSocket con mapi, `2x-content-scripts` para detección QBO). Los huecos quedan grandes mientras el plugin tenga pocos módulos.
