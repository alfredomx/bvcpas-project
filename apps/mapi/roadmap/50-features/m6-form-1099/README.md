# m6-form-1099 — Backend de M6 1099 Dashboard

**App:** mapi
**Status:** 📅 Pendiente
**Mx:** M6 (reemplaza GS 1099's)
**Versiones que lo construyen:** —
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m6-form-1099/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m6-form-1099/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx

Tracking anual de 1099 con dashboard cross-cliente. Hoy el operador maneja un GS manual con status, owner, fechas de cartas enviadas, etc. M6 hace que ese tracking viva en mapi y se actualice con datos reales (totales QBO).

**Detalle del GS actual:** ver [`docs/README.md` sección 7 — M6](../../../../../docs/README.md#m6--1099-dashboard-reemplaza-gs-1099s).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Tabla `form_1099_tracking` (naming TBD) con shape: client_id, year, owner, status (`Required | Not Required | Not Engaged | Completed | Partially Complete | On Hold | Good To Process | Ready Review`), final_request_letter_sent_at, iav_reviewed (bool), submitted (bool), notes.
- Endpoint `GET /v1/admin/dashboards/1099?year=YYYY` con grid cross-cliente.
- Endpoint `PATCH /v1/admin/1099/:client_id/:year` para actualizar status manual.
- Eventos event_log: `form_1099.status_changed`, `form_1099.submitted`.

### NO entra (preliminar)

- Envío real del 1099 al IRS — el operador lo hace en sistema externo.
- Cálculo de quién requiere 1099 — eso vive en M7 (W9 con filtros).
- UI — vive en bvcpas.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ P1 (`clients` con qbo_realm_id).
- (Independiente de M2/M3 — puede entrar antes si llega temporada 1099.)

---

## Notas

- Riesgo conocido: temporada 1099 es oct-ene. Si llega esa temporada sin M6, hay que pausar otros Mx para meterlo.
- Status enum (NAM-1) se aprueba cuando se abra la versión — lista actual del GS es la base.
