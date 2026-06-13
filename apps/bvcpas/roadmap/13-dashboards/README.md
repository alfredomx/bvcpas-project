# 13-dashboards — Dashboards agregados (frontend)

**App:** bvcpas
**Status:** ✅ Completo (api wrapper sobre `GET /v1/clients/:id/uncats` + hook `useUncatsDetail`, consumido por la tab Uncat. Transactions)
**Versiones que lo construyen:** v0.5.0 (primera view real `uncats-detail`)
**Última revisión:** 2026-06-12
**Espejo backend:** [`apps/mapi/roadmap/13-dashboards/`](../../../mapi/roadmap/13-dashboards/README.md)

---

## Por qué existe este módulo

Cuando una pantalla del operador necesita combinar muchas tablas +
cálculos agregados, mapi expone un endpoint custom por pantalla en
`/v1/dashboards/<nombre-pantalla>`. El frontend consume esos
endpoints aquí, en un módulo dedicado.

Match 1:1 con `apps/mapi/src/modules/13-dashboards/`.

---

## Estado

`api/uncats-detail.api.ts` (wrapper sobre
`GET /v1/clients/:id/uncats?from=&to=`) y hook `useUncatsDetail`,
consumidos por la tab Uncat. Transactions (stats agregados del cliente).
El endpoint `/v1/dashboards/customer-support` del plan original fue
eliminado (D-bvcpas-027): la sidebar pasó a `GET /v1/clients` y este
módulo quedó para el detalle de uncats por cliente.

---

## Qué expone

Ver `src/modules/13-dashboards/README.md`.

---

## Endpoints de mapi consumidos

| Endpoint                               | Cuándo                                  |
| -------------------------------------- | --------------------------------------- |
| `GET /v1/clients/:id/uncats?from=&to=` | Detalle de uncats por cliente (v0.5.0). |

---

## Versiones

- **v0.5.0** (✅): primera view real `uncats-detail` — api wrapper +
  `useUncatsDetail` sobre `GET /v1/clients/:id/uncats`, consumido por
  la tab Uncat. Transactions.
