# BACKLOG — `kiro`

Items diferidos del TDD del plugin, agrupados por **trigger concreto** que los reactiva.

---

## Por trigger

### Trigger: cuando mapi tenga WebSocket gateway listo (`/v1/bridge`)

> WebSocket client del plugin (service worker), reconnect logic, BridgeSecretGuard auth.

- (placeholder)

### Trigger: cuando se decida migrar BridgeSecretGuard → JWT

> Heredado de mapi v0.x: auth dual del plugin actual usa BridgeSecretGuard. La migración a JWT está diferida con trigger en BACKLOG de mapi v0.x. Cuando entre, kiro adopta el cambio.

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
