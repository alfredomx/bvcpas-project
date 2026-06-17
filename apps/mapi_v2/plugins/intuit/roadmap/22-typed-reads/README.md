# 22-typed-reads — lecturas tipadas de QBO (GET-only)

Reemplaza el `call` genérico por **un endpoint dedicado y tipado por cada type de QBO**: listas de entidades (Query API), lectura por id, y reports. Todo es **read-through** (lee en vivo de QuickBooks, no guarda en DB todavía) y **GET-only** (sin POST/PATCH/DELETE).

> **Arquitectura del sistema:** [`../../../README.md`](../../../README.md). · **Cara pública del plugin:** [`../README.md`](../README.md). · **Decisiones:** [`../README.md`](../README.md) (`D-intuit-NNN`).

## Por qué

`POST /realms/:realmId/call { method, path, body }` (v0.1.0) obliga al consumidor a construir el path de QBO y acepta cualquier método. Para connectors/backfill/CDC necesitamos lecturas **descubribles, tipadas y acotadas a GET**. Cada type de QBO (que el operador volcó en `src/types/`) tiene aquí su propia ruta.

## Diseño

- **Una ruta literal por type.** No hay un `:entity` genérico. `IntuitEntitiesController` declara `GET /:clientId/<entidad>` (list) y `.../<entidad>/:id` (by-id); `IntuitReportsController` declara `GET /:clientId/reports/<report>`. Sin segmento `clients` (todo cuelga ya de `/v1/intuit`). La superficie es per-type; lo que se comparte es la plomería.
- **`IntuitReadService`** es la plomería: `list` (arma `SELECT * FROM <Entity>` + paginación), `getById` (`/<entidad>/:id`), `report` (`/reports/<Name>?args`), `exchangeRate` (GET dedicado). Construye sobre `IntuitApiService.call` (refresh transparente + retry-on-401 ya resueltos en v0.1.0).
- **Catálogo único** (`qbo-catalog.ts`): `QBO_ENTITIES` (ruta→entidad QBO) y `QBO_REPORTS` (ruta→report QBO). Un test (`qbo-catalog.spec.ts`) cruza que las rutas registradas en los controllers coincidan 1:1 con el catálogo (sin faltantes ni de más).
- **Tipado:** cada endpoint devuelve el type de `src/types/` (`Promise<Account[]>`, `Promise<Report>`, …) vía el genérico del service.
- **Paginación:** las listas aceptan `?startPosition` y `?maxResults` (1–1000, default 1000). Los reports reenvían sus query params tal cual como args a QBO.
- **Auth:** todo bajo el `AdminGuard` global.

## Alcance (qué entra)

- **30 entidades** (list + by-id): account, attachable, bill, bill-payment, class, company-currency, credit-memo, customer, department, deposit, employee, estimate, invoice, item, journal-entry, payment, payment-method, preferences, purchase, purchase-order, refund-receipt, sales-receipt, tax-agency, tax-code, tax-rate, term, time-activity, transfer, vendor, vendor-credit.
- **1 GET dedicado:** exchange-rate (no es queryable; requiere `sourcecurrencycode`).
- **20 reports:** account-list-detail, apaging-detail, apaging-summary, araging-detail, araging-summary, balance-sheet, cash-flow, customer-balance, customer-balance-detail, customer-income, general-ledger, inventory-valuation-summary, journal-report, profit-and-loss, profit-and-loss-detail, transaction-list, trial-balance, vendor-balance, vendor-balance-detail, vendor-expenses.

Total: **30×2 + 1 + 20 = 81 endpoints.**

## Exclusiones conscientes

- **`CompanyInfo`** — ya tiene endpoint propio mapeado (`GET /clients/:clientId/company-info`, v0.1.0). No se duplica.
- **`TaxService`** — create-only en QBO (`POST /taxservice/taxcode`); no es leíble. Su propia doc dice usar `TaxCode` para leer.
- **`common.type` / `common-report.args`** — tipos base compartidos, no entidades/reports.

## GET-only (regla)

Este módulo **solo lee**. Nada de POST/PATCH/DELETE contra QBO. Las mutaciones se agregan después, una por una, cuando el operador las pida. (Ver memoria `feedback_solo_get_qbo`.)

## Flujo (list de una entidad)

1. `GET /v1/intuit/:clientId/invoices?maxResults=50` (con token admin).
2. `AdminGuard` valida el JWT; `ZodValidationPipe` valida `clientId` (uuid) y la paginación.
3. `IntuitReadService.list(clientId, 'Invoice', {maxResults:50})` resuelve el `realmId` (token válido, refresca si venció) y arma `SELECT * FROM Invoice STARTPOSITION 1 MAXRESULTS 50`.
4. `IntuitApiService.call` pega a `/company/:realmId/query?query=...` (si 401, refresca y reintenta 1 vez).
5. Devuelve `QueryResponse.Invoice ?? []` tipado como `Invoice[]`.

## Errores

Reusa los de v0.1.0: `INTUIT_TOKENS_NOT_FOUND` (404, sin conexión), `INTUIT_REFRESH_EXPIRED` (401, re-autorizar), `INTUIT_BAD_REQUEST` (400, QBO devolvió 4xx — p.ej. by-id de un singleton), `INTUIT_AUTH_ERROR` (502). No agrega errores nuevos.

## Versiones

| Versión | Estado | Tema                                        | Tag           | Archivo             |
| ------- | ------ | ------------------------------------------- | ------------- | ------------------- |
| 0.3.0   | ✅     | endpoints GET tipados (entidades + reports) | intuit-v0.3.0 | [v0.3.0](v0.3.0.md) |
