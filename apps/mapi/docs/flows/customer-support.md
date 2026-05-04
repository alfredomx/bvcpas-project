# Flujo: Customer Support

**Pantalla**: primera tab del dashboard home. Maneja transacciones uncategorized + AMAs + respuestas del cliente.
**Módulo backend**: [`12-customer-support`](../../roadmap/12-customer-support/README.md).
**Versión inicial**: v0.6.0 (2026-05-04).
**Endpoints relacionados** (reference técnica): tags `Transactions`, `Followups`, `Public` en Scalar (`/v1/docs`).

---

## Conceptos

| Término                 | Qué es                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Snapshot**            | Lo que QBO devolvió la última vez que el operador hizo sync. Vive en `client_transactions`. Es **volátil**: cada sync borra todo del rango y reinserta.                                                |
| **Uncats**              | Transacciones con `category IN ('uncategorized_expense', 'uncategorized_income')`. Se mandan al cliente.                                                                                               |
| **AMAs**                | "Ask My Accountant". `category = 'ask_my_accountant'`. **NO se mandan al cliente**, se revisan internamente con un contador.                                                                           |
| **Response**            | Nota que el cliente escribió para una transacción específica. Vive en `client_transaction_responses`. **Persistente** — sobrevive a sync. UPSERT: una sola respuesta por transacción, edita la última. |
| **Followup**            | Status mensual del cliente (`pending`, `sent`, `complete`, etc.). Una fila por `(client_id, period)`.                                                                                                  |
| **Public link**         | Token único por cliente para que entre al formulario sin auth. Reutilizable mes a mes.                                                                                                                 |
| **Filter**              | `clients.transactions_filter` ∈ {`all`, `expense`, `income`}. Define qué uncats ve el cliente en el formulario público. AMAs NUNCA llegan al público.                                                  |
| **draft_email_enabled** | Bool en `clients`. Si `false`, el cliente no recibe email — el staff llama y llena en su nombre.                                                                                                       |

---

## Flujo del operador (admin)

### 1. Cargar el dashboard completo (lista maestra)

Al entrar al dashboard, el frontend hace **una sola llamada** que trae todos los clientes activos con sus stats agregados:

```http
GET /v1/dashboards/customer-support?from=2025-01-01&to=2026-04-30
Authorization: Bearer <jwt>
```

Tag Scalar: `Dashboards`. **Versión:** v0.6.1.

**Frontend calcula `from` y `to`**: `from = ${currentYear-1}-01-01`, `to = último día del mes anterior`.

Response: por cada cliente activo, devuelve `stats` (uncats_count, amas_count, responded_count, progress_pct, amount_total, last_synced_at), `followup` (status, sent_at), `monthly` (previous_year_total + by_month con los 12 meses del año actual). Esto es lo que pinta la tabla de la imagen 2 (lista maestra) y los badges del sidebar.

Frontend filtra por `tier`, `status`, etc. en JS — no se hacen más requests al backend para eso.

### 1.b. Detalle de un cliente (panel central)

Cuando el operador click en un cliente:

```http
GET /v1/dashboards/customer-support/<clientId>?from=2025-01-01&to=2026-04-30
Authorization: Bearer <jwt>
```

Tag Scalar: `Dashboards`. Mismo shape que list pero por un cliente, con campos extra: `client.primary_contact_name`, `client.cc_email`, `followup.last_reply_at`, `followup.internal_notes`, `stats.silent_streak_days`.

Esto es lo que se ve en la imagen 1 (panel central del cliente seleccionado).

### 2. Sync mensual (botón "Sync" en el dashboard)

Frontend calcula:

- `startDate = "${yearActual - 1}-01-01"` (siempre 01 de enero del año pasado).
- `endDate = último día del mes anterior` (ej. hoy 2026-05-04 → endDate = `2026-04-30`).

```http
POST /v1/transactions/sync
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "clientId": "<uuid>",
  "startDate": "2025-01-01",
  "endDate": "2026-04-30"
}
```

Tag Scalar: `Transactions`.

**Lógica del backend:**

1. Llama a Intuit `/reports/TransactionList?start_date=...&end_date=...&accounting_method=Accrual`.
2. Filtra rows con regex `/uncategorized (expense|income)|suspense|ask/i` en `ColData[7]`.
3. **Borra** todo `client_transactions WHERE client_id = X AND txn_date BETWEEN startDate AND endDate`.
4. **Inserta** lo que vino de Intuit.
5. Emite `client_transactions.synced` en `event_log`.

**Importante**: las **respuestas del cliente** (en `client_transaction_responses`) **NO se tocan**. Si el cliente respondió y el sync borra la transacción correspondiente del snapshot, la respuesta queda en DB para auditoría. Anualmente el operador hace `TRUNCATE` manual del año cerrado.

**Errores**:

- 400 `CLIENT_NOT_CONNECTED` — cliente sin `qbo_realm_id`.
- 404 `CLIENT_NOT_FOUND`.

### 3. Ver lista de uncats / AMAs del cliente

```http
GET /v1/transactions?clientId=<uuid>&category=uncategorized_expense
Authorization: Bearer <jwt>
```

Tag Scalar: `Transactions`.

Filtros opcionales:

- `category` ∈ {`uncategorized_expense`, `uncategorized_income`, `ask_my_accountant`}.
- `filter` ∈ {`all`, `income`, `expense`} — override del filter del cliente.
- `startDate`, `endDate`.

Sin filtros, devuelve **todo** (incluye AMAs). Para mostrar solo lo del cliente final, pasar `filter` o `category`.

### 4. Ver respuestas del cliente (admin)

```http
GET /v1/transactions/responses?clientId=<uuid>
Authorization: Bearer <jwt>
```

Tag Scalar: `Transactions`.

Devuelve TODAS las respuestas históricas (incluso de transacciones que ya no aparecen en el snapshot porque ya se categorizaron). Útil para auditoría: "¿qué dijo el cliente sobre esta transacción cuando respondió en abril?".

### 5. Borrar transacción individual del snapshot

Caso: el contador ve un uncat antes de mandarlo al cliente, sabe qué es, lo categoriza directo en QBO. Para que no aparezca al cliente:

```http
DELETE /v1/transactions/<id>
Authorization: Bearer <jwt>
```

Tag Scalar: `Transactions`. Recibe el UUID interno (no el `qbo_txn_id`).

La respuesta del cliente (si la había) se preserva en `client_transaction_responses`. Solo se borra la fila del snapshot.

### 6. Crear/obtener link público

```http
POST /v1/public/links
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "clientId": "<uuid>",
  "purpose": "uncats"
}
```

Tag Scalar: `Public`.

**Idempotente**: si ya existe un link activo del mismo `purpose` para ese cliente, devuelve el mismo. Para forzar uno nuevo (rotación por filtración del token): `{"force": true}` en el body — revoca el actual y crea uno nuevo.

**Response shape**:

```json
{
  "id": "<uuid>",
  "client_id": "<uuid>",
  "token": "<64 hex chars>",
  "purpose": "uncats",
  "expires_at": null,
  "revoked_at": null,
  "max_uses": null,
  "use_count": 0,
  "created_at": "2026-05-04T...",
  ...
}
```

El frontend construye la URL pública: `https://<frontend>/uncats/<token>` (la ruta del frontend es decisión del frontend; backend solo da el token).

### 7. Listar links del cliente

```http
GET /v1/public/links?clientId=<uuid>
Authorization: Bearer <jwt>
```

Tag Scalar: `Public`. Devuelve activos + revocados, ordenados por `created_at DESC`.

### 8. Revocar un link

```http
POST /v1/public/links/<linkId>/revoke
Authorization: Bearer <jwt>
```

Tag Scalar: `Public`. Marca `revoked_at = now()`. El cliente que use ese token de aquí en adelante recibe 410.

### 9. Followup (status mensual)

```http
GET /v1/followups?clientId=<uuid>&period=2026-04
Authorization: Bearer <jwt>
```

Tag Scalar: `Followups`. Si no existe row, retorna default `{status: "pending", ...}` sin escribir.

```http
PATCH /v1/followups?clientId=<uuid>&period=2026-04
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "status": "sent",
  "sentAt": "2026-04-13T15:00:00Z",
  "internalNotes": "enviado por correo a Hector Zavala"
}
```

Body acepta cualquier subset de: `status`, `sentAt`, `lastReplyAt`, `sentByUserId`, `internalNotes`. Strict — campos no listados → 400.

**Statuses válidos**: `pending`, `ready_to_send`, `sent`, `awaiting_reply`, `partial_reply`, `complete`, `review_needed`.

Cuando cambia `status`, emite `client_followup.status_changed` con `{from, to}`.

---

## Flujo del cliente final (público, sin JWT)

### 1. Ver sus transacciones

El cliente recibe un link tipo `https://<frontend>/uncats/<token>`. El frontend llama:

```http
GET /v1/public/transactions/<token>
```

Tag Scalar: `Public`. **Sin Authorization header**.

**Response**:

```json
{
  "client": {
    "id": "<uuid>",
    "legal_name": "Acme LLC",
    "transactions_filter": "all"
  },
  "items": [
    {
      "id": "<uuid>",
      "txn_date": "2026-04-15",
      "vendor_name": "Acme",
      "memo": "lunch",
      "split_account": "Bank of America #5096",
      "category": "uncategorized_expense",
      "amount": "50.00",
      "client_note": null,
      "responded_at": null,
      ...
    }
  ]
}
```

**Filtros aplicados automáticamente:**

- AMAs **siempre** excluidas (cliente nunca las ve).
- Si `client.transactions_filter = 'expense'` → solo `uncategorized_expense`.
- Si `'income'` → solo `uncategorized_income`.
- Si `'all'` → ambas.

**Errores**:

- 404 `PUBLIC_LINK_INVALID` — token no existe.
- 410 `PUBLIC_LINK_REVOKED` — fue revocado.
- 410 `PUBLIC_LINK_EXPIRED` — `expires_at < now` o `use_count >= max_uses`.
- 403 `PUBLIC_LINK_PURPOSE_MISMATCH` — el token no es de purpose `uncats`.

### 2. Guardar nota para una transacción

```http
PATCH /v1/public/transactions/<token>/<txnId>
Content-Type: application/json

{
  "note": "lunch con cliente X, viaje a Houston"
}
```

Tag Scalar: `Public`. **Sin Authorization header**. `:txnId` es el UUID interno de la transacción (el del listado del paso anterior).

**Lógica del backend**:

1. Valida el token.
2. Busca la transacción por UUID; verifica que pertenezca al cliente del token (anti-IDOR).
3. Rechaza si la transacción es AMA (`TRANSACTION_NOT_FOUND_IN_SNAPSHOT`).
4. UPSERT en `client_transaction_responses`:
   - Si NO había respuesta → INSERT con snapshot inline (vendor_name, memo, etc.) + `client_note`.
   - Si SÍ había → UPDATE de `client_note`, `responded_at`, snapshot inline.
5. Emite `client_transaction_response.saved` con `{isUpdate: true|false}`.

**Errores**:

- 404 `TRANSACTION_NOT_FOUND_IN_SNAPSHOT` — la transacción ya no está (sync nuevo la borró).
- 410 si el token está revocado/expirado.
- 400 si la nota es vacía o > 5000 chars.

### 3. Re-entrar después de un mes

El mismo `token` sigue funcionando indefinidamente (reutilizable). En el siguiente mes el operador hace nuevo sync, las transacciones nuevas aparecen automáticamente al cliente cuando vuelve a entrar al link.

**Caso especial — sync borró transacciones que el cliente había contestado**: la respuesta queda en `client_transaction_responses` (persistente) pero ya no aparece en el listado del cliente porque la transacción correspondiente del snapshot se fue. Para el cliente es transparente — solo ve lo del periodo activo.

---

## Notas operativas

### Cuándo NO llamar `POST /v1/transactions/sync`

- Mientras el cliente está respondiendo el formulario actual. Si el operador hace sync nuevo y QBO ya no tiene una transacción que el cliente había respondido, esa respuesta queda huérfana en `transaction_responses` (no se pierde, pero deja de aparecer al cliente).
- **Recomendación operativa**: sync se hace 1 vez al mes (día 2 del nuevo mes), después de cerrar todas las uncats del periodo anterior.

### Para empezar el flujo de un mes nuevo

Pseudocódigo del operador:

```
1. POST /v1/transactions/sync con startDate=2025-01-01, endDate=último día del mes anterior.
2. Revisar uncats con GET /v1/transactions?clientId=...&category=uncategorized_expense.
3. Para uncats que el contador conoce, categorizarlas directo en QBO + DELETE /v1/transactions/<id>.
4. POST /v1/public/links (idempotente — devuelve el link reutilizable del cliente).
5. PATCH /v1/followups con status='ready_to_send' o 'sent' (cuando se envíe el email).
6. Mandar email al cliente con el link.
7. Cliente entra, llena → endpoints públicos.
8. Operador revisa respuestas con GET /v1/transactions/responses?clientId=....
9. PATCH /v1/followups con status='review_needed' o 'complete' al terminar.
```

### Para empezar el flujo de un cliente nuevo

1. Cliente se conectó vía OAuth (módulo `20-intuit-oauth`).
2. Se crea automáticamente con `tier='silver'`, `transactions_filter='all'`, `cc_email='lorena@bv-cpas.com'` (default vía env), `draft_email_enabled=true`.
3. PATCH `/v1/clients/<id>` para personalizar tier, filter, cc_email si aplica.
4. Sigue el flujo mensual normal.

---

## Lo que NO entra todavía

Estos endpoints/features **no existen** en v0.6.0. Están planeados:

- **Email integration** (v0.6.1) — `POST /v1/transactions/notify` que manda email al cliente con el link.
- **Writeback a QBO** (v0.6.2) — `POST /v1/transactions/sync-to-qbo` que escribe `client_note` al campo `Memo` de QBO vía Intuit V3 update.
- **Cron auto-status** (v0.6.3) — recalcula `client_period_followups.status` automáticamente cuando todas las uncats del periodo tienen respuesta.

Mientras tanto, esos pasos son manuales (operador manda email externo, copia notas a QBO a mano si necesita, actualiza status con PATCH).
