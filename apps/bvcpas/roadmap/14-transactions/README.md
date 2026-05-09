# 14-transactions — Transacciones del cliente

**App:** bvcpas
**Status:** ✅ v0.5.1 cerrada (api + hooks + sync, consumido desde la tab Uncat. Transactions).
**Versiones que lo construyen:** [v0.5.1](v0.5.1.md)
**Última revisión:** 2026-05-09

---

## Por qué existe este módulo

Espejo del módulo `apps/mapi/src/modules/14-transactions/`. mapi
expone:

- `GET /v1/clients/:id/transactions` — listado del snapshot del
  cliente. Filtros por `category`/`filter`/`startDate`/`endDate`.
- `POST /v1/clients/:id/transactions/sync` — destructivo, jala
  TransactionList de Intuit y reescribe el snapshot dentro del rango.

El frontend consume ambos desde la tab Uncat. Transactions del
cliente. CRUD plano (D-bvcpas-026) — no es view. Por eso vive aquí
y no en `13-dashboards`.

---

## Qué expone

| Símbolo                        | Descripción                                                                |
| ------------------------------ | -------------------------------------------------------------------------- |
| `listTransactions`             | Wrapper sobre `GET /v1/clients/:id/transactions`. Acepta `category` etc.   |
| `syncTransactions`             | Wrapper sobre `POST /v1/clients/:id/transactions/sync`.                    |
| `useTransactions(id, cat)`     | Hook TanStack Query. queryKey `['transactions', clientId, category]`.      |
| `useSyncTransactions(id)`      | Mutation. `onSuccess` invalida `transactions` + `uncats-detail`.           |
| `Transaction`                  | Shape de un item del snapshot (derivado del SDK).                          |
| `TransactionCategory`          | `'uncategorized_expense' \| 'uncategorized_income' \| 'ask_my_accountant'`. |
| `SyncResult`                   | `{ deleted_count, inserted_count, duration_ms, ... }`.                     |

## Endpoints consumidos

- `GET /v1/clients/:id/transactions[?category=&filter=&startDate=&endDate=]`
- `POST /v1/clients/:id/transactions/sync` con `{ startDate, endDate }`.

## Versiones

- v0.5.1 — primera versión: api + hooks (`useTransactions`,
  `useSyncTransactions`). Consumido por `<CsTransactions>` del módulo
  `12-customer-support`.

## Notas

- snake_case 1:1 con backend (D-bvcpas-020).
- Sync es destructivo dentro del rango. `client_transaction_responses`
  vive en otra tabla y se preserva por `qbo_txn_id`.
- Sin paginación (mapi no la documenta).
- Ni `useTransactions` ni `useSyncTransactions` aplican el
  `transactions_filter` del cliente — ese filtro afecta sólo el
  follow-up al cliente, no la vista del operador (admin ve todo).
