# 20-intuit/02-bridge — WebSocket gateway para plugin kiro

**App:** mapi
**Status:** 📅 Pendiente (P2)
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este sub-bloque

Algunas queries de QuickBooks Online (Uncats, getOfxPostedTransactions, etc.) no están expuestas por la API pública de Intuit — solo se pueden ejecutar desde dentro de la sesión web del operador en QBO. Por eso existe el plugin Chrome `kiro` que actúa como ejecutor: corre en el navegador del operador, ejecuta queries internas QBO, y manda los resultados al backend.

Este sub-bloque es el lado del backend: WebSocket gateway en `/v1/bridge` que el plugin usa para enviar batches de datos y recibir comandos. Depende de `01-oauth` (necesita identificar al cliente por `qbo_realm_id`).

---

## Alcance (TBD — se diseña cuando arranque la versión)

### Sí entra (preliminar)

- WebSocket gateway en `/v1/bridge` (Nest WS adapter).
- BridgeSecretGuard: auth simple para plugin con shared secret en env.
- Endpoints HTTP del bridge: `POST /v1/qbo-internal/sync-batch`, etc. (cuando se necesiten).
- Idempotencia de batches via Redis SETNX con TTL.
- Eventos event_log: `qbo_internal.batch_received`, `qbo_internal.batch_completed`, `qbo_internal.batch_failed`.

### NO entra (preliminar)

- Mappers de las entidades — entran con el Mx que los pida.
- Migración de BridgeSecretGuard a JWT — diferida con trigger en BACKLOG.

---

## Notas

- Heredado: bridge actual de mapi v0.x funcionaba bien. Lo reusamos con renames.
- Body parser limit 1GB (heredado D-124 mapi v0.x — batches grandes).
