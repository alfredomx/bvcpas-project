# m1-admin — Backend de M1 Dashboard Administrator

**App:** mapi
**Status:** 📅 Pendiente
**Mx:** M1 (reemplaza GS Dashboard Administrator)
**Versiones que lo construyen:** —
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m1-admin/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m1-admin/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx

M1 es el control central del operador: por cliente decide qué fechas procesar, si está enabled, si manda email draft, qué filter aplicar. Es el dashboard de orquestación que alimenta a M2/M3.

**Detalle del GS actual y mejoras pedidas:** ver [`docs/README.md` sección 7 — M1](../../../../../docs/README.md#m1--dashboard-administrator-reemplaza-gs-dashboard-administrator).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Extensión de `11-clients` con columnas de configuración: `enabled`, `email_drafts_enabled`, `filter` (`all|expense|income`), `start_date`, `end_date`, `contact_name`, `contact_email`, `cc_email`, `notes`.
- Endpoints admin: `GET /v1/admin/clients`, `PATCH /v1/admin/clients/:id/config`.
- Validaciones: rangos de fecha coherentes, filter enum válido.

### NO entra (preliminar)

- UI — vive en bvcpas.
- Lógica de envío de email draft real — eso vive en M3 (Customer Support) o se delega a n8n hasta que un Mx lo pida.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ P1 (`20-intuit/01-oauth/`): el `qbo_realm_id` de cada cliente viene de aquí.
- ⏳ Migración de los 77 clientes desde mapi v0.x.

---

## Notas

- Naming visible al operador (NAM-1) se aprueba cuando se abra la versión.
- Sin AuthGuard hasta que entre `10-core-auth`.
