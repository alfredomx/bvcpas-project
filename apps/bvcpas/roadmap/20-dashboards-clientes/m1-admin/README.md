# m1-admin — UI de M1 Dashboard Administrator

**App:** bvcpas
**Status:** 📅 Pendiente
**Mx:** M1 (reemplaza GS Dashboard Administrator)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m1-admin/`](../../../../mapi/roadmap/50-features/m1-admin/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado UI)

El operador necesita una página donde ve TODOS sus clientes en una tabla y puede editar config por cliente: enabled/draft, fechas a procesar, filter, contact, email, notes. Es su control central.

**Detalle del GS actual:** ver [`docs/README.md` sección 7 — M1](../../../../../docs/README.md#m1--dashboard-administrator-reemplaza-gs-dashboard-administrator).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Página `/admin/clients` con tabla de todos los clientes.
- Columnas visibles: company, qbo_realm_id, enabled (toggle), draft (toggle), filter (select), start_date, end_date, contact, email, cc_email, notes.
- Edición inline (toggle/select) o modal de detalle.
- Búsqueda + filtros (mostrar solo enabled, etc.).

### NO entra (preliminar)

- Endpoint de creación de cliente nuevo via UI — eso vive en P1 (OAuth callback crea cliente).
- Estadísticas/agregados — eso es M3.

---

## Pre-requisitos

- ⏳ `10-core-ui/` con AuthClient + layout listo.
- ⏳ Backend `m1-admin` con `GET /v1/admin/clients` y `PATCH /v1/admin/clients/:id/config`.

---

## Notas

- Probablemente es el primer dashboard funcional del proyecto. Decisión de stack visual (Tailwind + shadcn) se cierra aquí o justo antes.
