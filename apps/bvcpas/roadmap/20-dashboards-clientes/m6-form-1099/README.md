# m6-form-1099 — UI de M6 1099 Dashboard

**App:** bvcpas
**Status:** 📅 Pendiente
**Mx:** M6 (reemplaza GS 1099's)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m6-form-1099/`](../../../../mapi/roadmap/50-features/m6-form-1099/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado UI)

Tracking anual cross-cliente del proceso 1099. El operador edita status, marca progreso, agrega notas.

**Detalle del GS actual:** ver [`docs/README.md` sección 7 — M6](../../../../../docs/README.md#m6--1099-dashboard-reemplaza-gs-1099s).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Página `/dashboards/1099?year=YYYY` con tabla cross-cliente.
- Columnas: Owner, Status (select editable), Date Final Letter, Client, Form (link), IAV Reviewed (toggle), 1099 Submitted (toggle), Notes.
- Filtros por status / por owner.
- Selector de año (2025, 2024, etc.).

### NO entra (preliminar)

- Envío real al IRS — sistema externo.
- Generación del archivo 1099 — entra si el operador lo pide después.

---

## Pre-requisitos

- ⏳ `10-core-ui/`.
- ⏳ Backend M6.

---

## Notas

- Riesgo conocido: si entra temporada 1099 (oct-ene), este Mx sube prioridad sobre M2/M3.
