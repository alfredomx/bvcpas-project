# 13-views — Vistas globales agregadas para el operador

> **Renombrado desde `13-dashboards/` en v0.8.0** (D-mapi-019).
> La historia previa se preserva en git: para ver versiones anteriores
> usar `git log --follow apps/mapi/roadmap/13-views/v0.6.1.md`.

Módulo que agrupa las **vistas tabulares cross-cliente** que el
operador consume en el dashboard. Cada vista es una tabla de TODOS los
clientes con datos agregados (counts, status, KPIs).

A diferencia de los sub-recursos del cliente (que viven bajo
`/v1/clients/:id/<x>`), las vistas viven bajo `/v1/views/<x>` porque
operan sobre N clientes a la vez.

## Convención de URLs

```
GET /v1/views/uncats              ← lista global de uncats por cliente
GET /v1/views/recon               ← (futuro) reconciliations
GET /v1/views/w9                  ← (futuro) W-9 status
GET /v1/views/1099                ← (futuro)
GET /v1/views/mgt-report          ← (futuro) Management Report
GET /v1/views/tax-packet          ← (futuro)
GET /v1/views/qtr-payroll         ← (futuro)
GET /v1/views/property-tax        ← (futuro)
```

Cada vista global tiene su contraparte por cliente bajo
`/v1/clients/:id/<x>` que vive en `12-customer-support/clients/`
(ej: `/v1/clients/:id/uncats` para el detalle del cliente).

## Versiones

| Versión                               | Estado | Resumen                                                                                                               |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| [v0.6.1](v0.6.1.md)                   | ✅     | Dashboard customer-support (creado bajo el nombre antiguo `13-dashboards/`).                                          |
| [v0.8.0](../21-connections/v0.8.0.md) | 🚧     | Refactor URLs + módulo renombrado a `13-views/`. Path `/v1/views/uncats` reemplaza `/v1/dashboards/customer-support`. |
| [v0.12.1](v0.12.1.md)                 | ✅     | `public_link` extendido con `id`/`max_uses`/`use_count`/`revoked_at` + fix `responded_count` excluye soft-deleted.    |
