# 11-clients (frontend)

Módulo del dominio de clientes. Match 1:1 con
[`apps/mapi/src/modules/11-clients/`](../../../../mapi/src/modules/11-clients).

## Estado en v0.4.0

**Funcional.** Expone el wrapper `listClients()` sobre
`GET /v1/clients` (vía SDK tipado), el hook `useClients()` que
TanStack Query usa, y los tipos derivados del schema.

Es el **primer consumidor del SDK tipado en producción**
(D-bvcpas-028).

## Qué expone

| Símbolo                                 | Para qué                                                            |
| --------------------------------------- | ------------------------------------------------------------------- |
| `listClients` (`api/clients.api.ts`)    | Wrapper sobre `GET /v1/clients`. Devuelve `ClientsListResponse`.    |
| `useClients()` (`hooks/use-clients.ts`) | Hook React. Devuelve `{ items, isLoading, isError }`.               |
| `Client`                                | Shape canónico de un cliente (derivado de `ClientDto` del SDK).     |
| `ClientsListResponse`                   | Response paginado: `{ items, total, page, pageSize }`.              |
| `ClientStatus`                          | `'active' \| 'paused' \| 'offboarded'`.                             |
| `ClientTier`                            | `'silver' \| 'gold' \| 'platinum'`.                                 |

## Endpoints de mapi consumidos

- `GET /v1/clients` — listar (v0.4.0).
- `GET /v1/clients/:id` — detalle (futuro).
- `PATCH /v1/clients/:id` — editar (futuro).
- `POST /v1/clients/:id/status` — cambiar status (futuro).

## Versiones

- v0.3.0 — tipos mínimos.
- v0.4.0 — `listClients` + `useClients`. Sidebar consume este hook
  (D-bvcpas-027).

## Pantallas que lo consumen

- `<Sidebar>` (módulo `15-app-shell`) — pinta la lista de clientes.
- `[clientId]/layout.tsx` — valida que el `clientId` de la URL
  exista antes de renderizar las tabs.

## Notas

- snake_case 1:1 con backend (D-bvcpas-020). `client.legal_name`,
  `client.qbo_realm_id`, etc. Sin adapters camelCase.
- Tipos derivados del SDK (`@/lib/api/schema`). Si mapi cambia un
  campo, regenerar con `npm run sdk:gen` y los lugares que rompen
  aparecen como errores TS.
- v0.4.0 NO usa los query params `status`/`tier`/`search` del backend.
  El sidebar mantiene su search local con `useState`. Cuando se
  necesite filtrado server-side, se agregan al wrapper.
