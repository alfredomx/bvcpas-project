# m7-w9 — Backend de M7 W9 Dashboard con filtros guardados

**App:** mapi
**Status:** 📅 Pendiente
**Mx:** M7 (reemplaza GS W9 cliente)
**Versiones que lo construyen:** —
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m7-w9/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m7-w9/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx

El más complejo de los 7. El operador necesita filtrar gastos QBO por categoría (ej. `Rent`, `Subcontractors`) para identificar qué vendors requieren 1099. **Pero también necesita excluir vendors que sabe que NO requieren** (ej. Home Depot en Repairs). El sistema debe **recordar las exclusiones por cliente**.

**Detalle del GS actual y mejora pedida:** ver [`docs/README.md` sección 7 — M7](../../../../../docs/README.md#m7--w9-dashboard-con-filtros-guardados-reemplaza-gs-w9-cliente).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Tabla `w9_filters` (naming TBD): client_id, name, included_categories (jsonb), excluded_vendors (jsonb), created_at, updated_at.
- Endpoint `POST /v1/admin/clients/:id/w9-filters` para crear filtro guardado.
- Endpoint `PATCH /v1/admin/w9-filters/:id` para agregar/quitar exclusiones.
- Endpoint `GET /v1/admin/clients/:id/w9-vendors?filter_id=X` que aplica el filtro y devuelve: vendor + total Rent + total Subcontractor + status address (en QBO) + status tax_id (en QBO) + status mailed.
- Acción `POST /v1/admin/w9-vendors/exclude` (agrega a excluded_vendors del filtro).
- Eventos event_log: `w9.filter_created`, `w9.vendor_excluded`, `w9.filter_applied`.

### NO entra (preliminar)

- Envío automático de W9 al vendor — el operador lo hace manual.
- OCR del W9 recibido — futuro.
- UI — vive en bvcpas.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ P1 (clients + tokens Intuit).
- ⏳ Acceso a categorías/vendors de QBO (admin proxy de Intuit ya en P1, o se diseña aquí).
- (Por complejidad, M7 al final — pero puede subir prioridad si entra temporada 1099 y M6 lo demanda.)

---

## Notas

- "Recordar exclusión por cliente" es el aprendizaje del sistema. Si un Home Depot ya fue excluido, no aparece de nuevo aunque haga match por categoría.
- M7 es candidato natural a tener feedback continuo del operador (categorías que faltan, vendors que cambian de naturaleza).
