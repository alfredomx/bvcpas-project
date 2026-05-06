# 13-dashboards (frontend)

Módulo de dashboards agregados. Match 1:1 con
[`apps/mapi/src/modules/13-dashboards/`](../../../../mapi/src/modules/13-dashboards).

## Por qué existe

Cuando una pantalla del operador necesita combinar muchas tablas +
cálculos agregados + counts por mes, mapi expone un endpoint custom
por pantalla en `/v1/dashboards/<nombre-pantalla>`. El frontend
consume esos endpoints en este módulo.

Ver [docs de mapi 13-dashboards](../../../../mapi/roadmap/13-dashboards/README.md)
para la motivación backend.

## Estado en v0.3.0

**Mínimo: solo tipos.** El consumo real del endpoint
`GET /v1/dashboards/customer-support` se implementa en Bloque 3 de
v0.3.0 (TDD-first: tests primero, luego api/hook).

## Qué expone

| Símbolo                       | Para qué                                 |
| ----------------------------- | ---------------------------------------- |
| `FollowupStatus`              | Enum del status de followup mensual.     |
| `DashboardPeriod`             | `{ from, to }` del request/response.     |
| `CustomerSupportStats`        | Stats agregados de un cliente.           |
| `CustomerSupportFollowup`     | Status + sent_at del followup activo.    |
| `MonthlyBucket`               | Una fila de `{ month, uncats, amas }`.   |
| `CustomerSupportMonthly`      | Histograma mensual + total año anterior. |
| `CustomerSupportListItem`     | Una entrada de la lista maestra.         |
| `CustomerSupportListResponse` | Response completo del endpoint.          |

## Pantallas que lo consumen (planeadas)

- v0.3.0: sidebar (`CustomerSupportListItem[]` para pintar las filas
  de clientes).
- v0.4.0+: detalle del cliente (consumirá
  `GET /v1/dashboards/customer-support/:clientId`).

## Endpoints de mapi consumidos

- `GET /v1/dashboards/customer-support?from=&to=` — lista maestra (v0.3.0).
- `GET /v1/dashboards/customer-support/:clientId?from=&to=` — detalle
  por cliente (futuro).

## Notas

- snake_case 1:1 con backend (D-bvcpas-020).
- `amount_total` es `string` (no `number`): el backend usa decimal de
  Postgres y serializa como string para preservar precisión. Convertir
  a número en JSX solo donde se necesite (ej. comparación), no antes.
- `from`/`to` los calcula el frontend con la fórmula de mapi:
  `from = (currentYear - 1)-01-01`, `to = último día del mes anterior`.
