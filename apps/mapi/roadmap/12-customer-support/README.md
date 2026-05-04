# 12-customer-support — Customer Support tab del dashboard

**App:** mapi
**Status:** 🚧 En desarrollo (v0.6.0 cerrada — falta v0.6.1 email integration y v0.6.2 writeback)
**Versiones que lo construyen:** [v0.6.0](v0.6.0.md) (snapshot + responses + followups + public links)
**Última revisión:** 2026-05-04

---

## Por qué existe este módulo

La pestaña **Customer Support** del dashboard home es el primer tab visible cuando el operador entra al sistema. Maneja el flujo de **uncategorized transactions + AMAs**: bookkeeping diario que requiere input del cliente o de un contador interno.

Hoy ese flujo vive en Google Sheets: 1 GS por cliente, llenado manual con datos de Intuit pulled vía n8n, links únicos por GS para que el cliente complete las notas. Es funcional pero frágil, lento, sin auditoría real.

Con DB:

- Snapshot persistente del último pull de Intuit (`client_transactions`, volátil).
- Respuestas del cliente preservadas (`client_transaction_responses`, persistente — histórico hasta TRUNCATE anual).
- Status del periodo (`client_period_followups`) para badges/sidebar/filtros del dashboard.
- Tokens públicos reutilizables (`client_public_links`) genéricos — uncats hoy, encuestas/uploads/lo-que-sea mañana.

---

## Flujo

### Caso 1 — Operador hace snapshot mensual

1. Día 2 del mes: operador entra al dashboard, selecciona cliente, click **Sync**.
2. Frontend calcula fechas: `startDate = ${currentYear - 1}-01-01`, `endDate = último día del mes anterior`.
3. Frontend llama `POST /v1/clients/:id/transactions/sync?startDate=...&endDate=...`.
4. Backend:
   - Llama a Intuit `/reports/TransactionList` con esas fechas.
   - Filtra rows con regex `/uncategorized (expense|income)|suspense|ask/i` en ColData[7].
   - **`DELETE FROM client_transactions WHERE client_id=X AND txn_date BETWEEN startDate AND endDate`** (borrón total dentro del rango).
   - **`INSERT`** todas las que llegaron.
5. Si quiere mandar al cliente: click **Send** → genera/recupera token, manda email. (En v0.6.0 NO incluye envío de email — solo prepara link y deja `client_period_followups.status = 'ready_to_send'`.)

### Caso 2 — Cliente responde uncats (público, sin auth)

1. Cliente recibe email con link `https://bvcpas/client/uncats/<token>`.
2. Frontend llama `GET /v1/public/transactions/:token` (sin JWT).
3. Backend valida el token contra `client_public_links` (no expirado, no revocado, purpose=uncats).
4. Devuelve transacciones del cliente excluyendo AMAs y aplicando `clients.transactions_filter`.
5. Cliente escribe nota → frontend llama `PATCH /v1/public/transactions/:token/:qboTxnId` con `{ note }`.
6. Backend hace UPSERT en `client_transaction_responses` (UNIQUE por `client_id + qbo_txn_*`).
7. Cuando todas las respondidas → `client_period_followups.status = 'complete'` (cron o trigger).

### Caso 3 — Soft-delete manual (botón en dashboard)

1. Operador ve un uncat que ya categorizó manualmente en QBO. Click **Eliminar**.
2. Frontend llama `DELETE /v1/clients/:id/transactions/:qboTxnId`.
3. Backend hace `DELETE FROM client_transactions WHERE ...` (hard delete del snapshot).
4. Si había respuesta del cliente, queda intacta en `client_transaction_responses`.

### Caso 4 — Writeback a QBO (futuro, NO en v0.6.0)

Operador hace click en "Sync responses to QBO". Backend lee `client_transaction_responses WHERE synced_to_qbo_at IS NULL`, escribe el `client_note` al campo `Memo` de cada transacción vía Intuit V3, marca `synced_to_qbo_at = now()`. Esto va en v0.6.1+.

---

## Decisiones operativas

- **Snapshot volátil**: `client_transactions` se borra completa con cada sync dentro del rango. Las respuestas viven en tabla separada (`client_transaction_responses`), no se pierden.
- **Una respuesta por transacción**: el cliente puede editar; solo persiste la última versión (UPDATE no INSERT).
- **AMAs no se mandan al cliente**: filtra `category != 'ask_my_accountant'` en el endpoint público.
- **Filter del cliente** (`all`, `income`, `expense`): aplica en el endpoint público y opcionalmente en lectura admin. NO afecta sync.
- **Token reutilizable** para uncats: 1 token por cliente, sin expiración (BACKLOG: hacer privado).
- **Email default cc**: `lorena@bv-cpas.com` vía env var `DEFAULT_CC_EMAIL`. Cliente puede override con `cc_email` en su row.
- **Draft email enabled**: bool en `clients` para integraciones futuras de outreach (cuando integremos email provider).

---

## Schema

### `client_transactions` (volátil — snapshot del último sync)

PK compuesta `(realm_id, qbo_txn_type, qbo_txn_id)`. Sin UUID interna. Sin notes. Borrón con cada sync.

### `client_transaction_responses` (persistente — respuestas del cliente)

UUID PK. UNIQUE por `(client_id, realm_id, qbo_txn_type, qbo_txn_id)`. Snapshot inline de los datos al momento de responder + `client_note` + `responded_at` + `synced_to_qbo_at`.

### `client_period_followups` (1 fila por cliente × periodo)

UUID PK. UNIQUE por `(client_id, period)`. Campos: `status` enum (`pending | ready_to_send | sent | awaiting_reply | partial_reply | complete | review_needed`), `sent_at`, `last_reply_at`, `sent_by_user_id`, `internal_notes`.

### `client_public_links` (tokens públicos genéricos)

UUID PK. `token text UNIQUE`. `purpose` enum (`uncats` hoy). `expires_at` nullable. `revoked_at` nullable. `max_uses` + `use_count`. `metadata jsonb`. `created_by_user_id`.

### `clients` agrega:

- `draft_email_enabled boolean NOT NULL DEFAULT true`.
- `transactions_filter text NOT NULL DEFAULT 'all'` con CHECK enum (`all`, `income`, `expense`).
- `cc_email text NULL` (default aplicado en código vía env var `DEFAULT_CC_EMAIL`).

---

## Endpoints

### Admin (JWT requerido, role=admin)

- `POST /v1/clients/:id/transactions/sync?startDate=&endDate=` — pulla de Intuit, hard-delete + insert dentro del rango.
- `GET  /v1/clients/:id/transactions?category=&filter=` — listado con filtros opcionales.
- `DELETE /v1/clients/:id/transactions/:qboTxnId` — hard-delete individual del snapshot.
- `GET  /v1/clients/:id/transaction-responses` — listado de respuestas del cliente (incluye históricas que ya no aparecen en snapshot).
- `GET  /v1/clients/:id/followups?period=` — status del periodo. Si no existe, devuelve default `pending`.
- `PATCH /v1/clients/:id/followups?period=` — actualiza status, sent_at, internal_notes.
- `POST /v1/clients/:id/public-links` — crea o devuelve link reutilizable (idempotente por purpose).
- `GET  /v1/clients/:id/public-links` — lista links del cliente.
- `POST /v1/public-links/:id/revoke` — revoca un link.

### Público (sin JWT, autenticado por token)

- `GET   /v1/public/transactions/:token` — devuelve transacciones del cliente (filtradas por `transactions_filter`, excluyendo AMAs).
- `PATCH /v1/public/transactions/:token/:qboTxnId` — guarda nota del cliente.

---

## Errores de dominio nuevos

- `ClientNotConnectedError` (400) — cliente sin `qbo_realm_id`, no se puede sync.
- `PublicLinkInvalidError` (404) — token no existe.
- `PublicLinkRevokedError` (410) — token revocado.
- `PublicLinkExpiredError` (410) — token expirado o agotó max_uses.
- `PublicLinkPurposeMismatchError` (403) — token válido pero para otro purpose.
- `TransactionNotFoundInSnapshotError` (404) — el cliente intenta editar una transacción que ya no está en el snapshot (porque se hizo nuevo sync y desapareció).

---

## Eventos event_log

- `client_transactions.synced` — payload: `{ clientId, startDate, endDate, deletedCount, insertedCount, durationMs }`.
- `client_transaction.deleted` — payload: `{ clientId, qboTxnId, qboTxnType }`. Actor: admin.
- `client_transaction_response.saved` — payload: `{ clientId, qboTxnId, isUpdate }`. Actor: cliente vía token (actor_user_id null).
- `client_followup.status_changed` — payload: `{ clientId, period, fromStatus, toStatus }`. Actor: admin o sistema (cron).
- `client_public_link.created` — payload: `{ clientId, purpose, linkId }`. Actor: admin.
- `client_public_link.revoked` — payload: `{ clientId, linkId, reason? }`. Actor: admin.

---

## Versiones

- **v0.6.0** (en progreso): schema + sync + responses + followups + public links + endpoints. SIN email integration ni writeback.
- **v0.6.1** (planeada): integración email provider (Resend/SES/etc) — `POST /v1/clients/:id/transactions/notify` envía email al cliente con link.
- **v0.6.2** (planeada): writeback de notes a QBO — `POST /v1/clients/:id/transactions/sync-to-qbo`.
