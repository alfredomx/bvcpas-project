# 11-clients — CRUD base de clientes + configuración por cliente

**App:** mapi
**Status:** 📅 (schema cubierto por 20-intuit-oauth v0.3.0)
**Versiones que lo construyen:** ver [20-intuit-oauth/v0.3.0.md](../20-intuit-oauth/v0.3.0.md)
**Última revisión:** 2026-05-03

---

## ⚠️ Nota importante

El **schema `clients` viene dentro de [`20-intuit-oauth` v0.3.0](../20-intuit-oauth/README.md)**, no en una versión separada. Esto se decidió porque:

1. La tabla `clients` no tiene sentido sin tokens Intuit (un cliente bookkeeper SIEMPRE tiene su QBO autorizado).
2. La migración de los 77 clientes (v0.3.1) trae clients + intuit_tokens en un solo script.

**Cuándo se reabre este módulo:** cuando M1 (Dashboard Administrator) requiera **extender** clients con columnas de configuración operativa (sync_start_date, sync_enabled, email_drafts_enabled, filter, contact, cc_email, etc.). Esa extensión sí amerita su propia versión bajo `11-clients/v0.X.Y.md`.

Hasta entonces, el schema base de `clients` vive bajo el TDD de `20-intuit-oauth`.

---

## Por qué existe este módulo

Toda la operación del bookkeeper gira alrededor del concepto de "cliente" (una empresa con QuickBooks Online a la que el operador da servicio de bookkeeping). Sin esta tabla, no hay con qué relacionar tokens Intuit, syncs, dashboards, ni nada de Etapa 1.

Reusa el diseño de mapi v0.x con renames donde el naming no era consumible. Los 77 clientes existentes en mapi v0.x se migran cuando entre P1 (`20-intuit-oauth` v0.3.1).

---

## Alcance (TBD — se diseña cuando arranque la versión)

### Sí entra (preliminar)

- Tabla `clients` con shape mínimo: id, qbo_realm_id, company_name, contact_email, status, metadata, timestamps.
- Endpoints CRUD admin: `POST /v1/admin/clients`, `GET /v1/admin/clients`, `GET /v1/admin/clients/:id`, `PATCH /v1/admin/clients/:id`.
- Soft delete via `status='offboarded'` (heredado D-039 mapi v0.x).
- Configuración por cliente cuando entre M1 (Dashboard Administrator): `sync_start_date`, `sync_enabled`, `email_drafts_enabled`, `filter`, `start_date`, `end_date`, `cc_email`, etc.

### NO entra (preliminar)

- AuthGuard real — los endpoints son `@Public()` hasta que `10-core-auth` exista.
- Lógica de OAuth Intuit — vive en `20-intuit/01-oauth/`.
- UI — vive en `apps/bvcpas/roadmap/20-dashboards-clientes/m1-admin/`.

---

## Notas

- Naming visible al operador (NAM-1) se aprueba cuando se abra la versión.
- Schema definitivo se discute con el operador antes de generar migration.
- La mejora real de UX llega con M1 — este módulo solo hace que la tabla exista.
