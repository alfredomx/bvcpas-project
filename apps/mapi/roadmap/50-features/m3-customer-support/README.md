# m3-customer-support — Backend de M3 Customer Support Dashboard

**App:** mapi
**Status:** 📅 Pendiente
**Mx:** M3 (reemplaza GS Customer Support)
**Versiones que lo construyen:** —
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m3-customer-support/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m3-customer-support/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx

Vista cross-cliente del estado del proceso de uncats. Hoy el operador llena un GS manual con datos derivados de cada GS de uncats — M3 hace que con un click se actualice todo automático leyendo de la tabla de M2.

**Detalle del GS actual y mejoras pedidas:** ver [`docs/README.md` sección 7 — M3](../../../../../docs/README.md#m3--customer-support-dashboard-reemplaza-gs-customer-support).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Endpoint `GET /v1/admin/dashboards/customer-support` que agrega: por cliente, status del proceso uncats (`Need to review | Ready to Email | Email sent | No Uncats | Banking not Done | Sin Acceso a QB`), fecha última notif, total uncats, total $, progreso (% del total que ya tiene nota), totales por mes del año actual, total año pasado.
- Acción `POST /v1/admin/clients/:id/notify` para registrar fecha de notificación cuando el operador manda email.
- Eventos event_log: `customer_support.notified`.

### NO entra (preliminar)

- Envío real de email — el operador lo hace manual o vía n8n.
- UI — vive en bvcpas.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ P1 + P2.
- ⏳ M2 (`m2-uncats`): este dashboard es vista de los datos de M2.

---

## Notas

- Status enum y campos visibles al operador (NAM-1) se aprueban cuando se abra la versión.
