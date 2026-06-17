# 24-list-pagination — auto-paginado de los list (GET-only)

Arregla un footgun de v0.3.0: los `GET /:clientId/<entidad>` traían **una sola página** (`MAXRESULTS 1000`, el máximo de QBO) y **truncaban en silencio** a 1000 cuando la entidad tenía más. Ahora **auto-paginan** y devuelven todo, con un tope de seguridad explícito.

> **Cara pública:** [`../../README.md`](../../README.md). · **Decisiones:** [`../README.md`](../README.md) (`D-intuit-NNN`).

## Problema (v0.3.0)

`IntuitReadService.list` hacía `SELECT * FROM <entity> STARTPOSITION 1 MAXRESULTS 1000` — una página. QBO topa cada query en **1000**. Un cliente con 12 847 Purchases recibía **1000 callado**, sin señal de que faltaban ~11 800. Footgun para el consumidor (dashboards, exports).

## Diseño

- **Sin params** (`startPosition`/`maxResults` ausentes) → **auto-paginado**: loop de páginas de 1000 (`while`, no recursión) acumulando hasta que QBO devuelva < 1000 (exhausto). Devuelve TODO.
- **Tope de seguridad** `MAX_PAGES = 20` (20 000 registros). Si la página 20 vino llena (quedan más) → lanza **`INTUIT_TOO_MANY_RECORDS`** (400). **No trunca en silencio**: el caller debe acotar (fechas/filtro), paginar manual, o usar backfill (bulk real = jobs en background, versión futura).
- **Override manual**: si el caller manda `startPosition` y/o `maxResults` → **una sola página** desde esa posición (para UI que muestra de a poco). `maxResults` se clampa a 1000.
- **GET-only**: todo son reads; nada escribe en QBO.

`by-id`, `report`, `exchange-rate` no cambian. Solo `list`.

## Endpoint (sin cambios de ruta)

`GET /v1/intuit/:clientId/<entidad>` — ahora trae todo por default. `?startPosition=&maxResults=` siguen como override de una página.

## Error nuevo

| Código                    | Status | Caso                                                            |
| ------------------------- | ------ | --------------------------------------------------------------- |
| `INTUIT_TOO_MANY_RECORDS` | 400    | el auto-paginado superó el tope (20 000); acota o pagina manual |

## Alcance

### Sí entra

- `IntuitReadService.list` auto-paginado (loop + tope) + helper `fetchPage`.
- Error `IntuitTooManyRecordsError` (400, `INTUIT_TOO_MANY_RECORDS`).
- Unit tests del paginado (agota, avanza STARTPOSITION, tope→error, override, clamp).

### NO entra (diferido)

- Bulk real de entidades transaccionales enormes (>20k) en una llamada → backfill/jobs en background (como el mapi viejo), versión futura. Por ahora: error explícito que pide acotar.
- Cambiar la forma de respuesta a un envelope con `hasMore`/cursor — se mantiene array plano; el override manual cubre la paginación explícita.

## Versiones

| Versión | Estado | Tema                             | Tag           | Archivo             |
| ------- | ------ | -------------------------------- | ------------- | ------------------- |
| 0.5.0   | ✅     | auto-paginado de los list + tope | intuit-v0.5.0 | [v0.5.0](v0.5.0.md) |
