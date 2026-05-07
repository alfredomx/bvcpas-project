# 11-clients (frontend)

Módulo del dominio de clientes. Match 1:1 con
[`apps/mapi/src/modules/11-clients/`](../../../../mapi/src/modules/11-clients).

## Estado en v0.3.0

**Mínimo.** Solo expone tipos (`Client`, `ClientTier`, `ClientStatus`)
para que otros módulos del frontend los importen sin duplicar
declaraciones.

No hay API wrapper, ni hooks, ni componentes — todavía. La sidebar de
v0.3.0 NO consume `GET /v1/clients` directamente; consume
`GET /v1/dashboards/customer-support` porque ese endpoint trae los
stats agregados que la UI necesita (D-bvcpas-015).

## Qué expone

| Símbolo        | Para qué                                |
| -------------- | --------------------------------------- |
| `Client`       | Shape canónico de un cliente.           |
| `ClientTier`   | `'silver' \| 'gold' \| 'platinum'`.     |
| `ClientStatus` | `'active' \| 'paused' \| 'offboarded'`. |

## Endpoints de mapi (futuros)

- `GET /v1/clients` — listar (futuro).
- `GET /v1/clients/:id` — detalle (futuro).
- `PATCH /v1/clients/:id` — editar (futuro).
- `POST /v1/clients/:id/status` — cambiar status (futuro).

## Versiones

- v0.3.0 — tipos mínimos.
- vX.Y.Z futura — API wrapper + hooks cuando una pantalla lo requiera.

## Notas

- snake_case 1:1 con backend (D-bvcpas-020). `client.legal_name`,
  `client.qbo_realm_id`, etc. Sin adapters camelCase.
