# BACKLOG — `kiro`

Items diferidos del TDD del plugin, agrupados por **trigger concreto** que los reactiva.

---

## Por trigger

### Trigger: cuando mapi tenga WebSocket gateway listo (`/v1/bridge`, mapi v0.17.0)

> WebSocket client del plugin construido en v0.2.0 (`10-bridge-client`). Falta el smoke EN VIVO porque el gateway de mapi (`23-plugin-bridge`) aún no existe.

- [ ] Smoke round-trip real: kiro conecta → `hello` validado → mapi manda `execute_fetch` → kiro rutea a pestaña real → mapi recibe `result` correlacionado. (Cierra v0.2.0 + bump + tag `kiro-v0.2.0`.)
- [ ] Verificar reconnect real tras caída del gateway + keepalive MV3 (SW idle >30s reconecta vía alarm).

### Trigger: cuando un origin tenga >1 pestaña abierta y mapi quiera elegir cuál

> v0.2.0 rutea `execute_fetch` a la PRIMERA pestaña cuyo `origin` coincide (D-kiro-B06). Si un banco tiene varias pestañas del mismo origin y mapi necesita una específica, habrá que pasar un selector (tabId/identificador) en el payload.

- [ ] Selector de pestaña en el payload de `execute_fetch` (hoy: primera same-origin).

### Trigger: cuando se decida migrar BridgeSecretGuard → JWT

> Heredado de mapi v0.x: auth dual del plugin actual usa BridgeSecretGuard. La migración a JWT está diferida con trigger en BACKLOG de mapi v0.x. Cuando entre, kiro adopta el cambio (hoy el `hello` manda shared secret de `chrome.storage.local`).

- (placeholder)

### Trigger: cuando se necesite popup UI con datos reales

> Hoy popup es "Hello" estático. Cuando un workflow necesite mostrar estado al usuario (cliente conectado, último sync, etc.), entra UI real.

- (placeholder)

### Trigger: cuando se requiera publicación en Chrome Web Store

> Hoy se carga unpacked. Si en algún momento se quiere distribución oficial: privacy policy, screenshots, descripción, build firmado, etc.

- (placeholder)

---

## Histórico

(vacío — primera versión es v0.1.0)
