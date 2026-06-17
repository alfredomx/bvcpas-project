# Módulo `11-clients` (core) — entidad central de clientes

> Módulo de **dominio fundacional** del core. `clients` es la entidad central de la que cuelga todo lo demás (intuit, uncats, dashboards, followups). Modelo tipo WordPress: el core es dueño de la entidad central (como `posts`/`users` de WP core) y los plugins la extienden con su propia tabla llaveada por `client_id`.

> **Arquitectura del sistema:** [`../../../README.md`](../../../README.md) · **Decisiones e índice del core:** [`../README.md`](../README.md) · **Diferidos:** [`../BACKLOG.md`](../BACKLOG.md).

## Qué resuelve

Que el core tenga **una sola tabla de clientes**, genérica y agnóstica de proveedor, que cualquier plugin pueda leer (vía `ClientsService` inyectado) y extender (con su propia tabla). Sin esto, cada plugin reinventaría "qué es un cliente" o dependería de intuit solo para leerlos.

## Por qué `clients` vive en el core (no en un plugin)

`clients` lo consume **mucho más que un plugin**: intuit le cuelga tokens/realm, uncats le cuelga transacciones, dashboards lo agrupan, followups lo referencian. Promoverlo al core (revisando D-core-013 "core sin dominio" y D-core-015 "clients en intuit") evita que todo dependa de intuit. Es exactamente el patrón de WordPress: core dueño de la entidad central; plugins la extienden. (D-core-021)

## Alcance del módulo

| Pieza      | Ubicación            | Qué es                                                         |
| ---------- | -------------------- | -------------------------------------------------------------- |
| schema     | `core/db/schema`     | tabla `clients` genérica (sin nada de QBO) + migración         |
| repository | `modules/11-clients` | acceso a datos (list con filtros, get, create, update)         |
| service    | `modules/11-clients` | `ClientsService` exportado/`@Global` — lo inyectan los plugins |
| DTOs (Zod) | `modules/11-clients` | validación de create/update + query de lista                   |
| controller | `modules/11-clients` | endpoints `/v1/clients` (protegidos por `AdminGuard`)          |

## Cómo lo extiende un plugin (modelo WordPress / WooCommerce)

Cada plugin crea **su propia tabla llaveada por `client_id`** y lee el cliente vía `ClientsService` (no toca la tabla `clients` directo). Ejemplos:

- `intuit` → tabla `intuit_tokens` (`client_id` FK, `realm_id`, tokens encriptados).
- `uncats` → sus tablas de transacciones/respuestas/followups + sus flags (`draft_email_enabled`, `transactions_filter`, `cc_email`).

NO se usa una tabla `client_meta` genérica (estilo `postmeta`) por ahora — tabla propia por plugin: tipado fuerte, FKs, migraciones propias. (D-core-022)

## Lo que NO va aquí

- **Nada de QBO** (`realm_id`, tokens) → plugin `intuit`.
- **Flags de uncats** (`draft_email_enabled`, `transactions_filter`, `cc_email`) → plugin uncats.
- **`event_log` / auditoría** → diferido (BACKLOG). En este módulo los cambios solo se loguean por Pino + `correlation_id`.
- **`tier`** → no se incluye (al vender el producto todos son el mismo tier). Si se necesita, se agrega después.

## Versiones

| Versión | Estado | Tema                                        |
| ------- | ------ | ------------------------------------------- |
| v0.2.0  | 🔬     | Entidad `clients` en el core: schema + CRUD |
