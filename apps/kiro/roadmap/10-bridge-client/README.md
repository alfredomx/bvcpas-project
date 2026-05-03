# 10-bridge-client — WebSocket client + auth con mapi

**App:** kiro
**Status:** 📅 Pendiente (P2)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/20-intuit/02-bridge/`](../../../mapi/roadmap/20-intuit/02-bridge/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este bloque

El plugin `kiro` necesita un canal estable y autenticado con el backend `mapi` para:

1. Recibir comandos del operador (ej. "ejecuta esta query en QBO").
2. Enviar resultados de queries internas QBO.
3. Notificar status (cliente conectado, último sync, errores).

Este bloque construye el lado del cliente WebSocket: conexión inicial, auth con BridgeSecretGuard, reconnect con backoff, manejo de mensajes.

Es la contraparte cliente del backend `apps/mapi/roadmap/20-intuit/02-bridge/`.

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- WebSocket client en service worker (`chrome.runtime`).
- Auth con shared secret en `chrome.storage.local` (configurable desde popup).
- Reconnect automático con exponential backoff.
- Mensajes tipados (RPC-style: `{ type, payload, correlation_id }`).
- Storage de sesión activa: qué cliente QBO está abierto, último ping al backend.

### NO entra (preliminar)

- Content scripts QBO — viven en `20-qbo-scripts/`.
- UI compleja — popup sigue minimal hasta que un Mx lo necesite.
- Migración a JWT — diferida con trigger en BACKLOG.

---

## Permisos Chrome necesarios (preliminar)

- `storage` (guardar shared secret + estado de sesión).
- `host_permissions: ["https://mapi.kodapp.com.mx/*"]` (para WebSocket cross-origin).

Cada permiso requiere prompt al usuario en cada reload — solo se piden los que se usan.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ Backend `20-intuit/02-bridge/` con WebSocket gateway listo.

---

## Notas

- Heredado parcial de mapi v0.x: el plugin actual ya usa BridgeSecretGuard. Reusamos la lógica con renames si la convención cambia.
- Cuando JWT entre, este bloque tiene un trigger de migración (BACKLOG mapi v0.x).
