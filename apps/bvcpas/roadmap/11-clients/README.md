# 11-clients — Dominio de clientes (frontend)

**App:** bvcpas
**Status:** ✅ Completo (api `listClients`/`updateClient` + hooks `useClients`/`useUpdateClient`, consumidos por sidebar y detalle de cliente)
**Versiones que lo construyen:** v0.4.0 (api wrapper + `useClients`) + v0.4.1 (fix paginación sidebar) + v0.5.2 (`useUpdateClient`)
**Última revisión:** 2026-06-12
**Espejo backend:** [`apps/mapi/roadmap/11-clients/`](../../../mapi/roadmap/11-clients/README.md)

---

## Por qué existe este módulo

El dominio de "cliente" se referencia desde varios módulos del
frontend (sidebar, dashboards, tabs por cliente). Tener un módulo
dedicado evita duplicar el shape `Client` en cada lugar y centraliza
la API wrapper de `/v1/clients/*` cuando se necesite.

Match 1:1 con `apps/mapi/src/modules/11-clients/`. Mapi maneja CRUD
admin de clientes; frontend solo consume.

---

## Estado

`types.ts` (`Client`, `ClientTier`, `ClientStatus`) + `api/clients.api.ts`
(`listClients` sobre `GET /v1/clients`, `updateClient` sobre
`PATCH /v1/clients/:id`) + hooks `useClients` / `useUpdateClient`. La
sidebar consume `GET /v1/clients` directo desde v0.4.0 (D-bvcpas-027
superó a D-bvcpas-015; el endpoint `/v1/dashboards/customer-support`
fue eliminado).

---

## Qué expone

Ver `src/modules/11-clients/README.md`.

---

## Endpoints de mapi (futuros)

| Endpoint                      | Cuándo                             |
| ----------------------------- | ---------------------------------- |
| `GET /v1/clients`             | Lista admin (futuro).              |
| `GET /v1/clients/:id`         | Detalle (futuro).                  |
| `PATCH /v1/clients/:id`       | Editar campos operativos (futuro). |
| `POST /v1/clients/:id/status` | Cambiar status (futuro).           |

---

## Versiones

- **v0.4.0** (✅): api wrapper `listClients` + `useClients`; sidebar
  consume `GET /v1/clients` directo (D-bvcpas-026/027/028).
- **v0.4.1** (✅): fix paginación sidebar `pageSize=200` (D-bvcpas-029).
- **v0.5.2** (✅): `useUpdateClient` (`PATCH /v1/clients/:id`), usado
  por el config sheet.
