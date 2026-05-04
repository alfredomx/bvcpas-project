# 13-dashboards — Reportes agregados para pantallas del operador

**App:** mapi
**Status:** 🚧 En desarrollo (v0.6.1 customer-support)
**Versiones que lo construyen:** [v0.6.1](v0.6.1.md) (dashboard customer-support inicial)
**Última revisión:** 2026-05-04

---

## Por qué existe este módulo

Cuando una pantalla del operador necesita combinar **muchas tablas + cálculos agregados + counts por mes** para mostrarse, no tiene sentido pedirle al frontend que haga 5-10 requests y los componga. En su lugar exponemos **un endpoint custom por pantalla**, optimizado para esa pantalla, con shape específico.

Este módulo aloja todos esos endpoints. Convención:

```
GET /v1/dashboards/<nombre-pantalla>
GET /v1/dashboards/<nombre-pantalla>/:clientId   (cuando aplica)
```

Cada `<nombre-pantalla>` corresponde a una pestaña/dashboard del frontend (Customer Support, Reconciliations, W-9, 1099, Mgt Report, Tax Packet, QTR Payroll, Property Tax).

## Reglas de este módulo

- **Solo lectura**. Acciones (sync, delete, edit) viven en sus módulos respectivos. Aquí solo `GET`.
- **Shape específico por pantalla** — no se reutilizan DTOs entre dashboards. El frontend pide a este endpoint y obtiene EXACTAMENTE lo que necesita renderizar.
- **Filtros por rango**: `?from=YYYY-MM-DD&to=YYYY-MM-DD` requeridos siempre. Backend confía en lo que el frontend manda (frontend calcula `from = year-1, 01-01` y `to = último día del mes anterior` con `Date`).
- **Todo se agrupa bajo el tag Scalar `Dashboards`** para verlos juntos en `/v1/docs`.
- **Joins en SQL**, no en JS — estos endpoints son agregados/cuentan, ahí sí vale optimizar.

## Versiones

- **v0.6.1** (en progreso): primer dashboard — Customer Support. 2 endpoints (lista maestra + detalle de cliente).
- **v0.X.Y** futuras: Reconciliations, W-9, 1099, etc. Cada uno suma su sub-carpeta y endpoints.
