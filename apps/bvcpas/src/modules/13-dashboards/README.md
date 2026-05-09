# 13-dashboards (frontend)

**Estado:** vacío de código en v0.4.0. Reservado para views agregadoras.

## Por qué existe

Cuando una pantalla del operador necesita combinar muchas tablas +
cálculos agregados + counts por mes, mapi expone una **view** en
`/v1/views/<nombre>`. El frontend consume esos endpoints en este
módulo.

Ver
[`apps/mapi/src/modules/13-dashboards/`](../../../../mapi/src/modules/13-dashboards)
para la contraparte backend.

## Heurística view-vs-CRUD (D-bvcpas-026)

- Endpoint que devuelve un recurso plano (1:1 con tabla DB) →
  **CRUD**, vive en su módulo de dominio (ej. `/v1/clients` →
  módulo `11-clients`).
- Endpoint que orquesta múltiples recursos / cálculos / agregaciones
  para alimentar una pantalla → **view**, vive aquí en
  `13-dashboards`.

**Heurística:** si el frontend necesitaría 2+ fetch + JOIN/cálculo
para construir la pantalla, candidato a view.

## Historia

- v0.3.0 — el sidebar consumía `GET /v1/dashboards/customer-support`
  (lista maestra con monto + uncats + sparkline). Ese endpoint se
  eliminó del backend en mayo 2026.
- v0.4.0 — sidebar reapuntada a `GET /v1/clients` directo
  (D-bvcpas-027), porque tras el strip cosmético la fila ya no
  mostraba info enriquecida. El módulo `13-dashboards` quedó sin
  código, esperando una view real.

## Próximas views previstas

- `GET /v1/views/uncats` — alimentará la tab Customer Support del
  cliente (uncats + amas + monthly histogram + followup status).
  Implementación cuando entre la pantalla real de Customer Support.

## Notas

- snake_case 1:1 con backend (D-bvcpas-020).
- Cuando entre la primera view, los tipos del response se derivarán
  del SDK tipado (`@/lib/api/schema`) — no se duplican manualmente.
