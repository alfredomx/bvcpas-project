# 14-call-logs — Bitácora de llamadas a clientes

**App:** mapi
**Status:** ✅ Cerrado (v0.13.0)
**Versiones que lo construyen:** [v0.13.0](v0.13.0.md) (tabla + CRUD básico)
**Última revisión:** 2026-05-13

---

## Por qué existe este módulo

Registro simple de llamadas/contactos que hace el equipo a un cliente para perseguir respuestas (uncats sin responder, W-9 pendiente, etc.). **Es bitácora, no sistema de followups.** Sin recordatorios, sin notificaciones, sin cron — solo "registro lo que pasó".

Hoy esa información vive en cabeza del operador o en hojas sueltas. Sin registro:

- No hay forma de saber cuántas veces se contactó a un cliente antes de cerrar el mes.
- No hay evidencia para defender escalaciones ("le llamé 5 veces, nunca respondió").
- Si el operador cambia, el siguiente arranca desde cero sin contexto.

Con DB:

- `client_call_logs` con `client_id`, `user_id`, `called_at`, `outcome`, `notes`.
- Histórico consultable por cliente y por usuario.
- Edit para corregir errores. **Delete = hard delete** (D-mapi-053): se elimina físicamente; la auditoría queda en `event_log`.

> **Diferencia con `client_period_followups`:** followups es el estado del mes (pending / sent / complete). Call logs es la bitácora de los intentos de contacto. Se complementan pero no se vinculan en v0.13.0 (puede vincularse en versión futura si hace falta).

---

## Flujo

### Caso 1 — Operador registra una llamada

1. Operador entra al detalle del cliente en el dashboard.
2. Click **Registrar llamada** → modal con campos `outcome`, `notes`, `called_at` (default `now()`).
3. Frontend llama `POST /v1/clients/:id/call-logs`.
4. Backend:
   - Valida que el user tiene acceso al cliente (`ClientAccessGuard`).
   - Inserta row con `user_id` del JWT.
   - Devuelve el log creado.

### Caso 2 — Operador consulta histórico de llamadas

1. Operador entra al detalle del cliente.
2. Frontend llama `GET /v1/clients/:id/call-logs?limit=20&offset=0`.
3. Backend devuelve lista ordenada por `called_at DESC`, excluyendo soft-deleted.

### Caso 3 — Operador corrige un log

1. Click **Editar** en un log existente.
2. Frontend llama `PATCH /v1/clients/:id/call-logs/:logId` con campos a actualizar.
3. Backend valida ownership (cualquier user del despacho puede editar — no solo el que creó), actualiza, devuelve.

### Caso 4 — Operador borra un log

1. Click **Eliminar** en un log.
2. Frontend llama `DELETE /v1/clients/:id/call-logs/:logId`.
3. Backend hace `DELETE FROM client_call_logs WHERE ...` (hard delete).
4. Se emite evento `call_log.deleted` en `event_log` (queda traza ahí).

---

## Decisiones operativas

| Decisión                                                  | Razón                                                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Hard delete (D-mapi-053)                                  | Operador decidió: si borra, se va de la DB. Traza queda en `event_log` vía `call_log.deleted`.                                |
| Cualquier user puede editar/borrar logs de cualquier user | Equipo chico, todos confían. Si crece, se restringe en versión futura.                                                        |
| `user_id` se toma del JWT, no del body                    | Imposible falsificar autor.                                                                                                   |
| `called_at` editable                                      | Si registras la llamada al día siguiente, puedes corregir la hora real.                                                       |
| Sin vínculo a `client_period_followups`                   | Mantener simple. Si el dashboard de followups necesita "llamadas del mes X", se hace con query `WHERE called_at BETWEEN ...`. |
| Sin `period` column                                       | Se deriva de `called_at` si hace falta.                                                                                       |
| Sin enum `channel` (teléfono/email/WhatsApp)              | Solo teléfono en v0.13.0. Si después hay multi-canal, se agrega columna.                                                      |

---

## Schema

```sql
CREATE TABLE client_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  called_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('responded', 'no_answer', 'voicemail', 'refused', 'other')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_call_logs_client_idx
  ON client_call_logs (client_id, called_at DESC);
```

---

## Endpoints

| Método | Path                               | Auth                          | Qué hace                                                           |
| ------ | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| POST   | `/v1/clients/:id/call-logs`        | JWT admin + ClientAccessGuard | Crea log. Body: `{ outcome, notes?, called_at? }`.                 |
| GET    | `/v1/clients/:id/call-logs`        | JWT admin + ClientAccessGuard | Lista logs del cliente. Query: `limit`, `offset`.                  |
| PATCH  | `/v1/clients/:id/call-logs/:logId` | JWT admin + ClientAccessGuard | Actualiza log. Body: campos opcionales.                            |
| DELETE | `/v1/clients/:id/call-logs/:logId` | JWT admin + ClientAccessGuard | Hard delete: elimina la fila de la DB. Traza queda en `event_log`. |

---

## Errores de dominio

| Code                 | HTTP | Cuándo                                                                                 |
| -------------------- | ---- | -------------------------------------------------------------------------------------- |
| `CLIENT_NOT_FOUND`   | 404  | `clientId` no existe o user no tiene acceso.                                           |
| `CALL_LOG_NOT_FOUND` | 404  | `logId` no existe o pertenece a otro cliente.                                          |
| `BAD_REQUEST`        | 400  | Validación Zod falló (outcome fuera del enum, notes >2000, body vacío en PATCH, etc.). |

---

## Eventos `event_log`

| Tipo               | Cuándo         | Payload                        |
| ------------------ | -------------- | ------------------------------ |
| `call_log.created` | POST exitoso   | `{ logId, clientId, outcome }` |
| `call_log.updated` | PATCH exitoso  | `{ logId, clientId, changes }` |
| `call_log.deleted` | DELETE exitoso | `{ logId, clientId }`          |

`actor_user_id` = user del JWT en los 3 casos.

---

## Tag Scalar

`Client Management → Call Logs`

---

## Tests

Siguiendo el patrón de `12-customer-support`:

- **Tipo A (unit):** `CallLogsService` valida ownership, formatea outputs, llama repo.
- **Tipo B (integration DB real):** repo crea/lista/edita/borra, soft delete filtra correctamente.
- **No tests de controller HTTP** — los integration tests cubren el flujo completo.
