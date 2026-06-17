# 23-uncat-amas — report derivado de uncats + AMA (GET-only)

Primer report **derivado** de QBO: no es un report nativo (como los de v0.3.0, que son passthrough 1:1 con el catálogo), sino uno **construido** a partir del report `TransactionList` + filtrado + clasificación + mapeo. Es el reporte de transacciones **sin categorizar** (uncategorized expense/income) y **"Ask My Accountant"** (AMA) de un cliente — la base de lo que se le manda al cliente para que llene notas, y de lo que revisa el contador.

> **Cara pública del plugin:** [`../../README.md`](../../README.md). · **Decisiones:** [`../README.md`](../README.md) (`D-intuit-NNN`).

## Por qué

Es el primer report con valor operativo directo (reemplaza el GS de uncats que hoy se llena a mano). La lógica viene del mapi viejo (`12-customer-support/transactions/transactions-sync.service.ts`), ya probada contra clientes reales. Aquí se porta como **lectura en vivo** (read-through, GET-only), sin DB todavía — el snapshot/persistencia (para que el cliente llene notas) es de una versión futura.

## Diseño

- **Derivado, no passthrough.** `IntuitReadService` (v0.3.0) ya sabe pedir un report QBO. El nuevo `IntuitDerivedReportsService` pide `TransactionList` vía ese service y aplica el filtrado/clasificación/mapeo. No toca el catálogo `QBO_REPORTS` (ese sigue 1:1 con los passthrough y su test).
- **Controller separado** `IntuitDerivedReportsController` (mismo prefijo `/v1/intuit`, ruta bajo `/reports/`), para que el test de catálogo de los reports passthrough siga 1:1 sin tener que exceptuar rutas.
- **Una sola ruta** que trae uncats + AMA juntos, con filtro opcional por categoría.
- **GET-only.** No escribe nada en QBO. (La escritura de notas de vuelta a QBO es versión futura.)

## Origen QBO + mapeo (portado del mapi viejo, probado)

Pide `GET /company/:realmId/reports/TransactionList?start_date=&end_date=&accounting_method=Accrual`. De `Rows.Row[]`, **filtra** las filas cuyo `ColData[7].value` matchea `/uncategorized (expense|income)|suspense|ask/i`, y mapea por posición:

| Campo salida | Origen (`ColData[i]`)    | Nota                                       |
| ------------ | ------------------------ | ------------------------------------------ |
| `id`         | `[1].id`                 | qbo txn id                                 |
| `date`       | `[0].value`              | txnDate                                    |
| `txnType`    | `[1].value`              | "Expense", "Deposit", "Check", …           |
| `docnum`     | `[2].value`              |                                            |
| `vendor`     | `[4].value`              | (`[3]` se ignora, igual que el mapi viejo) |
| `memo`       | `[5].value`              |                                            |
| `account`    | `[6].value`              | split account                              |
| `category`   | derivada (ver abajo)     | a partir de `[7].value` y `txnType`        |
| `amount`     | `abs(Number([8].value))` | siempre positivo                           |

**Clasificación** (misma regla del mapi viejo):

- `[7].value` matchea `/ask/i` → `ask_my_accountant`
- si no, `txnType === 'Deposit'` → `uncategorized_income`
- si no → `uncategorized_expense`

> Mapeo **posicional** a propósito: es el que ya funciona contra los clientes reales (mapi viejo). Si QBO reordena columnas del TransactionList cambiaría; se documenta como supuesto y un smoke en vivo lo valida.

## Endpoint (`/v1/intuit`)

| Método | Ruta                            | Auth       | Qué hace                                                      |
| ------ | ------------------------------- | ---------- | ------------------------------------------------------------- |
| `GET`  | `/:clientId/reports/uncat-amas` | AdminGuard | uncats (expense+income) + AMA del cliente, lista plana tipada |

**Query params:** `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD), `accounting_method` (default `Accrual`), `category` (opcional: `uncategorized_expense` \| `uncategorized_income` \| `ask_my_accountant` — filtra a un solo bucket; sin él, devuelve los tres).

**Respuesta:** `UncatAmaRow[]` (lista plana). Cada fila con los campos de la tabla de arriba. `category` es el enum de los 3 buckets.

## Flujo

1. `GET /v1/intuit/:clientId/reports/uncat-amas?start_date=2025-01-01&end_date=2026-04-30` (token admin).
2. `AdminGuard` valida; `clientId` validado uuid.
3. `IntuitDerivedReportsService.uncatAmas(clientId, {startDate, endDate, accountingMethod})` → `IntuitReadService.report(clientId, 'TransactionList', args)`.
4. Filtra `Rows.Row` por el regex sobre `ColData[7]`, mapea, clasifica.
5. Si vino `category`, filtra a ese bucket. Devuelve la lista.

## Errores

Reusa los de v0.1.0 (no agrega nuevos): `INTUIT_TOKENS_NOT_FOUND` (404), `INTUIT_REFRESH_EXPIRED` (401), `INTUIT_BAD_REQUEST` (400, si QBO rechaza el report).

## Alcance

### Sí entra

- `IntuitDerivedReportsService.uncatAmas` (pide TransactionList, filtra, clasifica, mapea).
- `IntuitDerivedReportsController` con `GET /:clientId/reports/uncat-amas` + DTO de query (Zod).
- Type `UncatAmaRow` + enum de categoría.
- Unit tests (filtrado/clasificación/mapeo sobre un fixture de TransactionList) + smoke en vivo GET-only.

### NO entra (diferido)

- Persistencia/snapshot del reporte para que el cliente llene notas (eso es módulo aparte: tabla + escritura de notas de vuelta a QBO).
- Conteos/resúmenes (totales por mes/año) para el dashboard — el frontend los calcula sobre la lista, o se agregan luego si se necesitan server-side.
- AMA enviado a contadores vs uncats al cliente: aquí solo se exponen los datos; la lógica de "a quién se manda" es del módulo de outreach/dashboard.

## Versiones

| Versión | Estado | Tema                               | Tag           | Archivo             |
| ------- | ------ | ---------------------------------- | ------------- | ------------------- |
| 0.4.0   | ✅     | report derivado uncats + AMA (GET) | intuit-v0.4.0 | [v0.4.0](v0.4.0.md) |
