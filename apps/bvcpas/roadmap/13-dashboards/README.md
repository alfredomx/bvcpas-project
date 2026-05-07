# 13-dashboards — Dashboards agregados (frontend)

**App:** bvcpas
**Status:** 🚧 En desarrollo
**Versiones que lo construyen:** v0.3.0 (scaffolding + tipos del
endpoint customer-support)
**Última revisión:** 2026-05-06
**Espejo backend:** [`apps/mapi/roadmap/13-dashboards/`](../../../mapi/roadmap/13-dashboards/README.md)

---

## Por qué existe este módulo

Cuando una pantalla del operador necesita combinar muchas tablas +
cálculos agregados, mapi expone un endpoint custom por pantalla en
`/v1/dashboards/<nombre-pantalla>`. El frontend consume esos
endpoints aquí, en un módulo dedicado.

Match 1:1 con `apps/mapi/src/modules/13-dashboards/`.

---

## Estado en v0.3.0

Scaffolding + tipos. El api wrapper (`customer-support.api.ts`) y el
hook (`useClientsList`) entran en Bloque 3 de v0.3.0 con tests
TDD-first.

La sidebar consume el endpoint customer-support porque es el único que
trae los stats agregados que el prototipo muestra (D-bvcpas-015). Si en
el futuro hay ≥3 dashboards distintos compartiendo sidebar, se evaluará
un endpoint genérico `/v1/dashboards/sidebar` (BACKLOG).

---

## Qué expone

Ver `src/modules/13-dashboards/README.md`.

---

## Endpoints de mapi consumidos

| Endpoint                                                  | Cuándo                                |
| --------------------------------------------------------- | ------------------------------------- |
| `GET /v1/dashboards/customer-support?from=&to=`           | Sidebar — lista maestra (v0.3.0).     |
| `GET /v1/dashboards/customer-support/:clientId?from=&to=` | Detalle por cliente — futuro v0.4.0+. |

---

## Versiones

- **v0.3.0** (🚧): scaffolding + tipos del endpoint customer-support
  (lista maestra). El api wrapper y el hook se implementan en Bloque
  3 con tests TDD-first.

Versiones futuras: detalle por cliente cuando entre la pantalla de
Customer Support real (v0.4.0+).
