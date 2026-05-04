# 11-clients — CRUD admin de clientes

**App:** mapi
**Status:** 🚧 En desarrollo (CRUD base en v0.4.0, tier en v0.5.0; futuras versiones agregarán workflow mensual)
**Versiones que lo construyen:** [v0.4.0](v0.4.0.md) (CRUD inicial), [v0.5.0](v0.5.0.md) (tier silver/gold/platinum)
**Schema base:** creado en [20-intuit-oauth v0.3.0](../20-intuit-oauth/v0.3.0.md). v0.5.0 agregó columna `tier`. Próximas versiones agregarán schema para tareas/períodos mensuales.
**Última revisión:** 2026-05-04

---

## Por qué existe este módulo

77 clientes ya viven en `mapi_prod` (migrados desde mapi v0.x en v0.3.1). Hoy solo se pueden ver vía `psql` o el JOIN implícito en `GET /v1/intuit/tokens`. Falta:

- **Listar** clientes con filtros y paginación.
- **Ver detalle** de un cliente (incluye metadata expandida de Intuit: país, dirección, teléfono, website).
- **Editar** campos que no llegan de Intuit: `industry`, `entity_type`, `timezone`, `primary_contact_name`, `notes`.
- **Cambiar status** (`active` → `paused` → `offboarded`) — soft delete heredado de mapi v0.x.

Sin esto, los dashboards M1+ no pueden listar nada — todos consumen `/v1/clients` como fuente.

---

## Flujo

**Caso 1 — Listar clientes en dashboard.**

1. Admin entra al dashboard → React llama `GET /v1/clients?status=active&search=acme&page=1&pageSize=50`.
2. Backend valida JWT, consulta `clients` con filtros, devuelve `{items, total, page, pageSize}`.

**Caso 2 — Ver detalle.**

1. Admin click en cliente → `GET /v1/clients/:id`.
2. Backend devuelve cliente completo + metadata desempaquetada (`intuit_country`, `intuit_phone`, etc. a top-level).

**Caso 3 — Editar campos operativos.**

1. Admin abre form → `PATCH /v1/clients/:id` con body parcial.
2. Backend valida campos editables (no permite cambiar `id`, `qbo_realm_id`, `created_at`).
3. Emite `client.updated` en event_log con diff.

**Caso 4 — Cambiar status.**

1. Admin selecciona "Pausar" o "Dar de baja" → `POST /v1/clients/:id/status` con `{status: 'paused' | 'offboarded'}`.
2. Backend actualiza, emite evento `client.status_changed`.
3. **Status `offboarded` NO borra tokens** — quedan para auditoría. La operación normal los ignora porque filtra por `status='active'`.

---

## Decisiones operativas

- **No crear `POST /v1/clients`**: clientes nacen vía OAuth callback (`/v1/intuit/connect`), no vía CRUD admin. Crear sin realm sería un cliente fantasma sin QBO. Si en el futuro se necesita (cliente sin QBO), se agrega entonces.
- **Soft delete**: `status='offboarded'`. Tokens y filas se preservan para auditoría e historia. No hay `DELETE`.
- **Paths sin `/admin/`**: `@Roles('admin')` en el controller. (Convención del proyecto.)
- **Schema NO se toca**: las columnas son las de v0.3.0. Los campos vacíos (`industry`, `entity_type`, etc.) se llenan via PATCH cuando el operador los conozca. No se renombran ni añaden columnas en v0.4.0.

---

## Endpoints API

| Método | Path                     | Descripción                         | Roles |
| ------ | ------------------------ | ----------------------------------- | ----- |
| GET    | `/v1/clients`            | Listar paginado con filtros         | admin |
| GET    | `/v1/clients/:id`        | Detalle con metadata expandida      | admin |
| PATCH  | `/v1/clients/:id`        | Editar campos operativos            | admin |
| POST   | `/v1/clients/:id/status` | Cambiar status (active/paused/offb) | admin |

**`/v1/clients/:id/connect`** ya existe en `20-intuit-oauth` (re-auth target) — no se duplica aquí.

---

## Errores de dominio

- `ClientNotFoundError` (404) — ya existe desde v0.3.0, se reusa.
- `InvalidStatusTransitionError` (400) — futura, cuando entre validación de transiciones (no en v0.4.0).

---

## Eventos event_log

- `client.updated` — payload: `{ clientId, changedFields, before, after }`. Actor: admin que editó.
- `client.status_changed` — payload: `{ clientId, fromStatus, toStatus }`. Actor: admin.

---

## Versiones

- **v0.4.0** (en progreso): CRUD inicial — list/getById/update/changeStatus.
- **v0.4.x futuras** (no planeadas todavía): config operativa por cliente cuando entre M1 (sync_start_date, email_drafts_enabled, etc.).
