# m2-uncats — Backend de M2 Uncats Pipeline

**App:** mapi
**Status:** 📅 Pendiente
**Mx:** M2 (reemplaza GS Uncat por cliente)
**Versiones que lo construyen:** —
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m2-uncats/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m2-uncats/README.md)
**Plugin asociado:** [`apps/kiro/roadmap/20-qbo-scripts/m2-uncats-write/`](../../../../kiro/roadmap/20-qbo-scripts/m2-uncats-write/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx

Reemplaza el flujo manual del operador: hoy el cliente le pasa notas en un GS, n8n las consolida, un script las escribe en QBO. M2 hace que el operador suba notas en una UI propia, mapi las guarda, y kiro las escribe en QBO desde la sesión del operador.

**Detalle del GS actual y mejoras pedidas:** ver [`docs/README.md` sección 7 — M2](../../../../../docs/README.md#m2--uncats-pipeline-reemplaza-gs-uncat-por-cliente).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Tabla `uncats_transactions` (o equivalente — naming TBD) con shape de uncats QBO + columna `client_note` + `applied_at`.
- Endpoint `POST /v1/admin/clients/:id/uncats/sync` para extraer uncats de QBO (vía proxy admin Intuit).
- Endpoint `PATCH /v1/admin/uncats/:id/note` para guardar la nota del operador.
- Endpoint `POST /v1/admin/clients/:id/uncats/apply-notes` para enviar batch a kiro vía bridge.
- Eventos event_log: `uncats.synced`, `uncats.note_set`, `uncats.note_applied`, `uncats.apply_failed`.

### NO entra (preliminar)

- ML/categorización automática (Plus opcional del operador, NO en MVP).
- UI — vive en bvcpas.
- Escritura real a QBO — la hace kiro, mapi solo orquesta.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ P1 (`20-intuit/01-oauth/`): tokens vivos.
- ⏳ P2 (`20-intuit/02-bridge/` + `kiro/10-bridge-client/`): canal con plugin para escribir notas/memo.
- ⏳ M1 (`m1-admin`): config de cliente para saber start_date/end_date/filter.

---

## Notas

- Heredado de mapi v0.x: shape de uncats + write notas via bridge (probado).
- Naming visible al operador (NAM-1) se aprueba cuando se abra la versión.
