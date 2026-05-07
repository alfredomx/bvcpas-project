# 11-clients — Dominio de clientes (frontend)

**App:** bvcpas
**Status:** 🚧 En desarrollo (mínimo en v0.3.0; crece conforme las
pantallas lo requieran)
**Versiones que lo construyen:** v0.3.0 (scaffolding + tipos)
**Última revisión:** 2026-05-06
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

## Estado en v0.3.0

Mínimo: solo `types.ts` con `Client`, `ClientTier`, `ClientStatus`. La
sidebar de v0.3.0 NO consume `GET /v1/clients` — consume
`GET /v1/dashboards/customer-support` (D-bvcpas-015). Cuando una
pantalla necesite el detalle "raw" de un cliente, se agrega aquí el
api wrapper + hook correspondiente.

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

- **v0.3.0** (🚧): scaffolding + tipos. Sin api wrapper.

Versiones futuras: cuando una pantalla pida detalle de cliente, se
agrega el api wrapper + hook + componentes.
