# 11-clients — CRUD base de clientes + configuración por cliente

**App:** mapi
**Status:** 📅 Pendiente
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este módulo

Toda la operación del bookkeeper gira alrededor del concepto de "cliente" (una empresa con QuickBooks Online a la que el operador da servicio de bookkeeping). Sin esta tabla, no hay con qué relacionar tokens Intuit, syncs, dashboards, ni nada de Etapa 1.

Reusa el diseño de mapi v0.x con renames donde el naming no era consumible. Los 77 clientes existentes en mapi v0.x se migran cuando entre P1 (`20-intuit/01-oauth/`).

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
