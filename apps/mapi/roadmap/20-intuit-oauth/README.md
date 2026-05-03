# 20-intuit-oauth — OAuth Intuit + tokens encriptados + proxy V3

**App:** mapi
**Status:** 🚧 En desarrollo (v0.3.0)
**Versiones que lo construyen:** [v0.3.0](v0.3.0.md) (schema + endpoints), [v0.3.1](v0.3.1.md) (migración 77 clientes)
**Última revisión:** 2026-05-03

---

## Por qué existe este módulo

Todo el valor del proyecto depende de poder leer y escribir en QuickBooks Online de los clientes del operador. Para hacerlo, mapi necesita **autorización OAuth con Intuit por cada cliente bookkeeper**: un par de tokens (access + refresh) que se renuevan automáticamente mientras estén vigentes.

Sin este módulo:

- Ningún Mx puede consultar datos QBO (M2 Uncats, M3 Customer Support, M6 1099, M7 W9 quedan sin fuente).
- No se pueden migrar los 77 clientes que mapi v0.x ya tiene autorizados → quedan atrapados en mapi v0.x.

Es el primer pre-requisito post-auth. Una vez cerrado, los Mx pueden consumir Intuit V3 vía un endpoint genérico (`/v1/intuit/:realmId/call`) sin necesidad de que mapi exponga endpoints específicos por cada query.

**Heredado de mapi v0.x con renames mínimos.** mapi v0.x tiene este módulo probado en producción 19 versiones, incluyendo el fix crítico D-mapi-v0.x-118 (refresh transparente con shape completo del SDK). Lo traemos como referencia y reescribimos en bvcpas-project siguiendo el TDD (B en lugar de copy-paste).

---

## Alcance

### Sí entra

- **Tabla `intuit_tokens`** con shape heredado de mapi v0.x:
  - `client_id` (PK, FK a `clients.id` ON DELETE CASCADE).
  - `realm_id` (UNIQUE, NOT NULL).
  - `access_token_encrypted`, `refresh_token_encrypted` (AES-256-GCM).
  - `access_token_expires_at`, `refresh_token_expires_at`.
  - `last_refreshed_at` (NULL hasta primer refresh).
  - `created_at`, `updated_at`.
- **Tabla `clients`** mínima con shape heredado mapi v0.x: id, legalName, dba, qboRealmId, industry, entityType, fiscalYearStart, timezone, status, primaryContactName, primaryContactEmail, notes, metadata, timestamps. Schema viene **completo** desde el inicio porque la migración v0.3.1 trae los 77 con todos los campos poblados.
- **Encryption service** AES-256-GCM con `crypto` nativo Node (heredado D-mapi-v0.x-046). Key desde env var `ENCRYPTION_KEY` (32 bytes base64).
- **`IntuitOauthClientFactory`**: genera instancias del SDK `intuit-oauth` por cliente (no singleton porque `setToken` muta estado interno).
- **`IntuitTokensService`**: get/set/refresh transparente. Cuando `access_token` está por expirar, refresh automático antes de retornar al caller. Maneja `invalid_grant` → `IntuitRefreshTokenExpiredError` (HTTP 401 limpio, no 500).
- **`IntuitApiService`**: wrapper genérico sobre Intuit V3 API. Recibe `realmId`, busca tokens, hace refresh si necesario, ejecuta call HTTP. Auto-retry una vez en 401 (heredado D-mapi-v0.x-044).
- **`IntuitOauthService`**: orquesta el flujo OAuth completo (URL de autorización con state anti-CSRF en Redis 10 min TTL, callback exchange, persistencia de tokens cifrados, creación o silent re-auth de cliente).
- **Endpoints `/v1/intuit/*`** (paths sin `/admin/`, permisos por `@Roles()`):
  - `POST /v1/intuit/connect` (admin, era `authorize` en mapi v0.x). Genera URL Intuit para cliente nuevo o re-auth automática.
  - `POST /v1/clients/:id/connect` (admin). Re-auth target a un cliente existente.
  - `GET /v1/intuit/callback` (`@Public()`, lo llama Intuit). HTML success/error con close-tab script.
  - `POST /v1/intuit/:realmId/call` (admin). Proxy genérico Intuit V3.
  - `GET /v1/intuit/tokens` (admin). Lista status de tokens de todos los clientes (sin exponer secretos: solo realm_id, fechas, last_refreshed_at).
  - `DELETE /v1/intuit/tokens/:clientId` (admin). Elimina tokens (forzar re-auth manual).
- **Errores de dominio nuevos:**
  - `INTUIT_TOKENS_NOT_FOUND` (404).
  - `INTUIT_REFRESH_EXPIRED` (401) — refresh token caducó (>100 días sin uso), requiere re-autorización manual.
  - `INTUIT_AUTH_ERROR` (400) — Intuit rechazó el code en callback.
  - `INTUIT_BAD_REQUEST` (400) — Intuit V3 retornó 4xx en una query.
  - `INTUIT_STATE_INVALID` (400) — state del callback no matchea con Redis (CSRF o link viejo).
  - `CLIENT_NOT_FOUND` (404) — cuando se pasa client_id a `/clients/:id/connect` que no existe.
- **Eventos `event_log` nuevos:**
  - `intuit.client.created` (cliente nuevo creado vía callback).
  - `intuit.client.reauth_silent` (realm ya existía, tokens renovados sin user-target).
  - `intuit.client.reauth_target` (re-auth dirigida a un client_id específico).
  - `intuit.tokens.refreshed` (refresh transparente exitoso).
  - `intuit.tokens.refresh_failed` (refresh falló, probablemente refresh expirado).
  - `intuit.tokens.deleted` (admin eliminó tokens).
  - `intuit.api.call_failed` (call al proxy genérico falló).
- **Métricas Prometheus** (heredado mapi v0.x D-mapi-v0.x-072, D-mapi-v0.x-073):
  - `intuit_api_calls_total{path, status}` — counter.
  - `intuit_tokens_days_until_refresh_expiry{client_id}` — gauge actualizado por cron cada hora.
- **`ENCRYPTION_KEY` env var** validada en config.schema (32 bytes base64).
- **Migración 77 clientes** desde mapi v0.x prod (v0.3.1) y mapi v0.x local (también v0.3.1, después de validar prod).

### NO entra

- **Bridge WebSocket plugin↔backend** — vive en `21-intuit-bridge` (P2, otro módulo).
- **Connectors qbo-dev** (cron sync periódico) — vive en `22-connectors/qbo-dev/` cuando un Mx lo necesite.
- **Connectors qbo-internal** (sync vía plugin HTTP) — vive en `22-connectors/qbo-internal/`.
- **Mappers de entidades QBO** (Bill, Invoice, Payment, etc.) — entran con sus connectors.
- **Schema staging** (`staging_transactions`, `staging_qbo_internal`) — vive en `30-staging` cuando un Mx lo pida.
- **Tabla `qbo_sync_accounts`** (cuentas bancarias seleccionadas para sync) — `22-connectors/`.
- **Endpoints específicos por query Intuit** (lista vendors, lista accounts, etc.) — innecesarios con el proxy genérico.
- **Sandbox Intuit** — el operador usa solo producción y dev (no sandbox). El env var `INTUIT_ENVIRONMENT` solo acepta `production`.
- **OAuth para múltiples cuentas Intuit del operador** — el operador usa una sola cuenta Intuit Developer. Cada cliente bookkeeper autoriza su QBO company a esa cuenta única.

---

## Naming visible al operador (NAM-1)

### Tabla `clients`

| Columna                 | Tipo         | Constraint                      | Notas                                          |
| ----------------------- | ------------ | ------------------------------- | ---------------------------------------------- |
| `id`                    | UUID         | PK, default `gen_random_uuid()` |                                                |
| `legal_name`            | VARCHAR(200) | NOT NULL                        | Nombre legal de la empresa                     |
| `dba`                   | VARCHAR(200) | NULL                            | "Doing Business As"                            |
| `qbo_realm_id`          | TEXT         | UNIQUE                          | Llave de QBO company; nullable hasta autorizar |
| `industry`              | VARCHAR(80)  | NULL                            |                                                |
| `entity_type`           | VARCHAR(40)  | NULL                            | LLC / Corp / S-Corp / etc.                     |
| `fiscal_year_start`     | SMALLINT     | NULL, CHECK 1-12                | Mes inicio fiscal                              |
| `timezone`              | VARCHAR(60)  | NULL                            | `America/Mexico_City` ej.                      |
| `status`                | VARCHAR(20)  | NOT NULL, default `'active'`    | enum `active \| paused \| offboarded`          |
| `primary_contact_name`  | VARCHAR(120) | NULL                            |                                                |
| `primary_contact_email` | VARCHAR(255) | NULL                            |                                                |
| `notes`                 | TEXT         | NULL                            |                                                |
| `metadata`              | JSONB        | NULL                            | Extensiones libres (heredado D-038)            |
| `created_at`            | TIMESTAMPTZ  | NOT NULL, default `now()`       |                                                |
| `updated_at`            | TIMESTAMPTZ  | NOT NULL, default `now()`       | Trigger actualiza en cada UPDATE               |

**Índices:** `qbo_realm_id` (UNIQUE implícito), `(status, legal_name)` para listar.

**Soft delete vía `status='offboarded'`** (heredado D-mapi-v0.x-039). No hay `deleted_at`.

### Tabla `intuit_tokens`

| Columna                    | Tipo        | Constraint                                 | Notas                                               |
| -------------------------- | ----------- | ------------------------------------------ | --------------------------------------------------- |
| `client_id`                | UUID        | **PK**, FK `clients(id)` ON DELETE CASCADE | 1:1 con clients (heredado D-mapi-v0.x-085)          |
| `realm_id`                 | TEXT        | NOT NULL, UNIQUE                           | Defensa en profundidad además del UNIQUE en clients |
| `access_token_encrypted`   | TEXT        | NOT NULL                                   | AES-256-GCM con `ENCRYPTION_KEY`                    |
| `refresh_token_encrypted`  | TEXT        | NOT NULL                                   |                                                     |
| `access_token_expires_at`  | TIMESTAMPTZ | NOT NULL                                   | Intuit access dura ~1h                              |
| `refresh_token_expires_at` | TIMESTAMPTZ | NOT NULL                                   | Intuit refresh dura 100 días                        |
| `last_refreshed_at`        | TIMESTAMPTZ | NULL                                       | NULL = nunca se ha refrescado (recién autorizado)   |
| `created_at`               | TIMESTAMPTZ | NOT NULL, default `now()`                  |                                                     |
| `updated_at`               | TIMESTAMPTZ | NOT NULL, default `now()`                  |                                                     |

**¿Por qué `client_id` es PK y no `id`?** Heredado D-mapi-v0.x-085. La relación entre cliente y tokens es **1:1 estricta** (un cliente, un par de tokens vivos). Hacer `client_id` la PK directamente elimina una columna, un índice UNIQUE y simplifica los joins. La distinción "id del token" no existe en el dominio.

### Endpoints

| Method | Path                          | Auth              | Descripción                                                                                                                                         |
| ------ | ----------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/intuit/connect`          | `@Roles('admin')` | Genera URL Intuit. Si callback regresa con realm nuevo → crea cliente; si realm existe → silent re-auth (actualiza tokens).                         |
| POST   | `/v1/clients/:id/connect`     | `@Roles('admin')` | Re-auth target. Fuerza el binding del realm que regrese al `client_id` indicado. Útil cuando un cliente preexistente reautoriza.                    |
| GET    | `/v1/intuit/callback`         | `@Public()`       | Intuit redirige aquí después de autorizar. HTML success/error con `window.close()`.                                                                 |
| POST   | `/v1/intuit/:realmId/call`    | `@Roles('admin')` | Proxy genérico Intuit V3. Body: `{ method, path, body? }`. Backend reenvía con tokens del cliente. Auto-refresh + retry 1× en 401.                  |
| GET    | `/v1/intuit/tokens`           | `@Roles('admin')` | Lista status: `[{ clientId, realmId, accessExpiresAt, refreshExpiresAt, lastRefreshedAt, isAccessExpired, daysUntilRefreshExpiry }]`. Sin secretos. |
| DELETE | `/v1/intuit/tokens/:clientId` | `@Roles('admin')` | Elimina row (forzar re-auth manual). 404 si no existe.                                                                                              |

### Errores de dominio (mapping en `domain-error.filter.ts`)

| Code                      | HTTP | Cuándo se lanza                                                          |
| ------------------------- | ---- | ------------------------------------------------------------------------ |
| `INTUIT_TOKENS_NOT_FOUND` | 404  | El client_id no tiene tokens en `intuit_tokens`.                         |
| `INTUIT_REFRESH_EXPIRED`  | 401  | Refresh token >100 días sin uso. El admin debe re-autorizar manualmente. |
| `INTUIT_AUTH_ERROR`       | 400  | Intuit rechazó el code en callback (code expirado, mal-formado, etc.).   |
| `INTUIT_BAD_REQUEST`      | 400  | Intuit V3 retornó 4xx en una query (fault details adjuntos).             |
| `INTUIT_STATE_INVALID`    | 400  | El `state` del callback no matchea con Redis (CSRF o link de >10 min).   |
| `CLIENT_NOT_FOUND`        | 404  | `/clients/:id/connect` con id que no existe.                             |

### Eventos `event_log`

| Event type                     | Payload                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `intuit.client.created`        | `{ clientId, realmId, legalName }`                                     |
| `intuit.client.reauth_silent`  | `{ clientId, realmId }` (actor_user_id = admin que inició el connect). |
| `intuit.client.reauth_target`  | `{ clientId, realmId, requestedClientId }`                             |
| `intuit.tokens.refreshed`      | `{ clientId, realmId, accessExpiresAt, refreshExpiresAt }`             |
| `intuit.tokens.refresh_failed` | `{ clientId, realmId, reason }` (sin actor_user_id si fue cron).       |
| `intuit.tokens.deleted`        | `{ clientId, realmId }` (actor_user_id = admin).                       |
| `intuit.api.call_failed`       | `{ realmId, method, path, status, qboFault? }`                         |

### Configuración / env vars nuevas

| Variable               | Tipo            | Required | Default      | Notas                                             |
| ---------------------- | --------------- | -------- | ------------ | ------------------------------------------------- |
| `ENCRYPTION_KEY`       | base64 32 bytes | Sí       | —            | Generar con `openssl rand -base64 32`.            |
| `INTUIT_CLIENT_ID`     | string          | Sí       | —            | App "BV CPAs, PLLC" (production) en panel Intuit. |
| `INTUIT_CLIENT_SECRET` | string          | Sí       | —            |                                                   |
| `INTUIT_REDIRECT_URI`  | URL             | Sí       | —            | `https://mapi.kodapp.com.mx/v1/intuit/callback`.  |
| `INTUIT_ENVIRONMENT`   | enum            | No       | `production` | Solo `'production'` por ahora. Sin sandbox.       |
| `INTUIT_MINOR_VERSION` | number          | No       | `75`         | Heredado mapi v0.x.                               |

**Misma `ENCRYPTION_KEY`** que mapi v0.x. La migración (v0.3.1) copia los `*_encrypted` tal cual sin re-cifrar (D-mapi-v0.x: misma key, ahorra paso de re-encrypt).

---

## Flujos de runtime

### Flujo 1 — Autorizar un cliente nuevo (happy path)

1. Admin entra al dashboard, click "Conectar QBO".
2. Frontend → `POST /v1/intuit/connect` (con JWT admin).
3. Backend:
   - Genera UUID `state` aleatorio.
   - Guarda `state` en Redis con key `intuit:state:<state>` y TTL 10 min, value = `{ adminUserId, mode: 'new' }`.
   - Construye URL Intuit con `client_id`, `redirect_uri`, `scope`, `state`.
   - Retorna `{ authorize_url }`.
4. Frontend redirige browser del admin a Intuit. Admin selecciona la company QBO del cliente y autoriza.
5. Intuit redirige a `GET /v1/intuit/callback?code=xxx&state=yyy&realmId=zzz`.
6. Backend (callback):
   - Lee `state` de Redis. Si no existe → `IntuitStateInvalidError`. Si existe, lee `mode` y `adminUserId`, borra de Redis.
   - Llama a Intuit `/oauth2/v1/tokens/bearer` con `code` → recibe `access_token`, `refresh_token`, `expires_in`.
   - Cifra ambos con `EncryptionService` (AES-256-GCM).
   - Busca cliente por `realm_id` en `clients`. Si no existe (mode=`new` y realm nuevo):
     - Llama a Intuit V3 `/companyinfo/{realmId}` → obtiene legal_name, country, fiscal_year_start_month, primary_contact, etc.
     - INSERT en `clients` con esos datos canónicos.
     - INSERT en `intuit_tokens` con tokens cifrados.
     - Evento `intuit.client.created` con `actor_user_id = adminUserId`.
   - Si `realm_id` ya existe (silent re-auth):
     - UPDATE de `intuit_tokens` con tokens nuevos cifrados.
     - Evento `intuit.client.reauth_silent`.
7. Backend retorna HTML success con `window.close()` (page se abre como popup, se cierra sola).

### Flujo 2 — Re-auth target a cliente existente

1. Admin click "Re-conectar QBO" en un cliente específico.
2. Frontend → `POST /v1/clients/:id/connect`.
3. Backend valida que `client_id` existe (sino 404 `CLIENT_NOT_FOUND`).
4. Genera state con `mode: 'target'`, `targetClientId: id`.
5. Resto idéntico al flujo 1, pero el callback **fuerza el binding** al `targetClientId` aunque el realm sea distinto al previo (decision operativa: el admin manda).

### Flujo 3 — Request a Intuit V3 vía proxy genérico

1. Plugin/frontend/admin necesita una query Intuit (ej. listar vendors).
2. → `POST /v1/intuit/9876543210/call` con body `{ method: 'GET', path: '/v3/company/9876543210/query?query=...' }`.
3. Backend (`IntuitApiService.call`):
   - Busca cliente por `realm_id`. Si no existe → `IntuitTokensNotFoundError`.
   - Lee `intuit_tokens` y descifra `access_token`.
   - Si `access_token_expires_at < now() + 60s` → `refresh()` antes de la query (precaución de margen).
   - HTTP request a `https://quickbooks.api.intuit.com${path}` con `Authorization: Bearer <access_token>`.
   - Si Intuit retorna 401 una vez (token caducó entre el check y el request):
     - `refresh()` → re-intenta la query 1 sola vez.
     - Si también 401 → asumir refresh expirado → `IntuitRefreshTokenExpiredError`.
   - Si Intuit retorna 4xx (no 401) → `IntuitBadRequestError` con qbo fault details.
   - Si OK, retorna body de Intuit tal cual (sin transform). Métrica `intuit_api_calls_total{path, status=200}++`.

### Flujo 4 — Refresh transparente (interno)

1. `IntuitTokensService.getValidTokens(clientId)` se llama desde `IntuitApiService.call`.
2. Lee row, descifra.
3. Si `access_token_expires_at - 60s > now()` → retorna decrypted directo.
4. Si está por expirar:
   - Crea `IntuitOauthClient` (SDK) con shape **completo** del token (heredado fix D-mapi-v0.x-118: incluir `createdAt`, `expires_in`, `x_refresh_token_expires_in`. Sin esto, el SDK rechaza por validación interna sin llamar a Intuit).
   - `client.refresh()` → recibe nuevos tokens.
   - Cifra y UPDATE de la row con tokens nuevos + `last_refreshed_at = now()`.
   - Evento `intuit.tokens.refreshed`.
   - Si `client.refresh()` falla con `invalid_grant`:
     - Refresh token expirado (>100 días). Lanza `IntuitRefreshTokenExpiredError` (HTTP 401 limpio, no 500).
     - Evento `intuit.tokens.refresh_failed` con `reason: 'invalid_grant'`.
   - Si falla con otro error: log warn, propaga error genérico.
5. Retorna decrypted tokens (frescos).

### Flujo 5 — Cron de métrica de expiración

1. Cada hora (heredado D-mapi-v0.x-073), `IntuitTokensMetricsCron`:
   - Lee todos los tokens.
   - Calcula `daysUntilRefreshExpiry = (refresh_token_expires_at - now()) / 86400000`.
   - Setea gauge `intuit_tokens_days_until_refresh_expiry{client_id} = days`.
2. En `onApplicationBootstrap` también corre una vez (para tener valores al arrancar, no esperar 1h).

### Flujo 6 — Admin elimina tokens de un cliente

1. Admin click "Desconectar QBO" en un cliente.
2. → `DELETE /v1/intuit/tokens/:clientId`.
3. Backend:
   - DELETE FROM intuit_tokens WHERE client_id = :clientId. Si no había row → 404.
   - Evento `intuit.tokens.deleted` con actor_user_id.
   - El row de `clients` queda intacto. El cliente ahora aparece sin tokens hasta que un admin re-conecte.

---

## Decisiones operativas

### Refresh proactivo vs reactivo (60s margen)

`IntuitTokensService` refresca **antes** de que `access_token` expire (margen de 60 segundos). Razón: si refrescamos justo en el límite, hay race condition donde el access expiró entre nuestro check y el request a Intuit, y nos retorna 401. El margen de 60s evita 99% de ese caso. El 1% restante lo cubre el retry-on-401 de `IntuitApiService.call`.

### Sin distributed lock en refresh (mapi v0.x D-mapi-v0.x-043)

Si 2 requests simultáneas para el mismo cliente disparan refresh al mismo tiempo, ambas refrescan, la última gana. Intuit invalida el token previo así que el primer request resultante puede recibir 401 con el token "viejo" → reintenta con el token "nuevo" en DB. Trade-off conocido y aceptable hasta que se demuestre lock real necesario.

### Proxy genérico vs endpoints específicos

`/v1/intuit/:realmId/call` reemplaza endpoints específicos por query Intuit. Pro: cero código de mapi por cada query nueva (los Mx arman queries SQL Intuit). Contra: cualquier admin con JWT puede ejecutar queries arbitrarias contra Intuit. Aceptable porque `@Roles('admin')` y los admin son personas de confianza del operador.

### Mismo `ENCRYPTION_KEY` que mapi v0.x

La migración v0.3.1 copia `access_token_encrypted` y `refresh_token_encrypted` tal cual desde mapi v0.x. Si las keys fueran distintas, requeriríamos decrypt+re-encrypt durante migración (más complejo, más riesgo). Decidido: misma key. mapi v0.x se va a apagar después → key no queda compartida indefinidamente.

### Sin sandbox Intuit

`INTUIT_ENVIRONMENT` solo acepta `production` por ahora (heredado). Si llega caso de prueba con sandbox, se agrega como nueva validación. Hoy mapi v0.x usa solo prod y dev (no sandbox).

---

## Tests críticos

> Cobertura por CR. Tipo A son lógica unit con fixtures JSON; Tipo B son smoke E2E con DB real.

### EncryptionService (Tipo A)

- **CR-intuit-001:** `encrypt(plain)` retorna string distinto al plain. `decrypt(cipher)` retorna el plain original.
- **CR-intuit-002:** `encrypt` con la misma key 2 veces produce ciphertext **distinto** (random IV).
- **CR-intuit-003:** `decrypt` con key incorrecta lanza error.
- **CR-intuit-004:** `decrypt` con ciphertext modificado (1 byte cambiado) lanza error de auth tag.

### IntuitTokensService (Tipo A)

- **CR-intuit-010:** `getValidTokens` con tokens vigentes (access > 60s) retorna decrypted sin refresh.
- **CR-intuit-011:** `getValidTokens` con access próximo a expirar dispara refresh transparente.
- **CR-intuit-012:** Refresh exitoso UPDATE row con tokens nuevos + `last_refreshed_at = now()` + dispara evento `intuit.tokens.refreshed`.
- **CR-intuit-013:** Refresh con `invalid_grant` lanza `IntuitRefreshTokenExpiredError` + evento `intuit.tokens.refresh_failed`.
- **CR-intuit-014:** `getValidTokens` con `client_id` sin row → `IntuitTokensNotFoundError`.

### IntuitApiService (Tipo A)

- **CR-intuit-020:** `call` happy path retorna body de Intuit tal cual.
- **CR-intuit-021:** `call` con 401 reintenta una vez tras refresh.
- **CR-intuit-022:** `call` con 401 + 401 (segundo intento) → `IntuitRefreshTokenExpiredError`.
- **CR-intuit-023:** `call` con 4xx (no 401) → `IntuitBadRequestError` con qbo fault.
- **CR-intuit-024:** `call` incrementa `intuit_api_calls_total{path, status}`.
- **CR-intuit-025:** `call` con `realmId` sin tokens → `IntuitTokensNotFoundError`.

### IntuitOauthService (Tipo A)

- **CR-intuit-030:** `getAuthorizationUrlForNewClient` genera state UUID, lo guarda en Redis con TTL 600s, retorna URL con state embebido.
- **CR-intuit-031:** `handleCallback` con state inexistente en Redis → `IntuitStateInvalidError`.
- **CR-intuit-032:** `handleCallback` con realm nuevo → INSERT cliente desde companyInfo + INSERT tokens + evento `intuit.client.created`.
- **CR-intuit-033:** `handleCallback` con realm existente (mode=`new`) → silent re-auth: solo UPDATE tokens + evento `intuit.client.reauth_silent`.
- **CR-intuit-034:** `handleCallback` con `mode='target'` y target_client_id → asocia tokens al cliente target aunque realm sea distinto + evento `intuit.client.reauth_target`.
- **CR-intuit-035:** `handleCallback` con Intuit rechazando code → `IntuitAuthorizationError`.

### Cron de métricas (Tipo A)

- **CR-intuit-040:** Cron lee tokens y calcula `daysUntilRefreshExpiry`. Gauge se setea con valor correcto.
- **CR-intuit-041:** `onApplicationBootstrap` corre el cron una vez al arrancar.

### Smoke tests (Tipo B)

- **SMK-intuit-001:** Flujo completo OAuth con Intuit Developer Portal mockeado: connect → genera URL → callback con code mockeado → cliente creado en DB con tokens cifrados.
- **SMK-intuit-002:** `/v1/intuit/tokens` (GET) lista status sin exponer secretos (no aparece `access_token_encrypted` en response).
- **SMK-intuit-003:** `DELETE /v1/intuit/tokens/:clientId` borra row + evento. Cliente queda sin tokens.
- **SMK-intuit-004:** Cascade delete: DELETE cliente → tokens también borrados (constraint ON DELETE CASCADE).

---

## Cómo se trabaja el módulo (TDD-first)

Cada CR del listado es el orden del trabajo en `v0.3.0.md`. Por cada CR:

1. Escribo el test (Tipo A o B según el área) — corre y queda **rojo**.
2. Operador ve el rojo, valida que el test esté bien diseñado.
3. Implemento mínimo para pasar a verde.
4. Operador ve el verde, valida.
5. Siguiente CR.

**Pre-requisito:** mapi v0.2.0 (10-core-auth) cerrado, deployed en `mapi.kodapp.com.mx`. ✅

---

## Migración de los 77 clientes (v0.3.1)

Detalle completo en [v0.3.1.md](v0.3.1.md). Resumen:

- Script standalone `scripts/migrate-from-mapi-v0x.ts` que:
  1. Conecta a postgres de mapi v0.x **prod** (read-only) usando connection string en env separada (`MAPI_V0X_DATABASE_URL`).
  2. Lee `clients` y `intuit_tokens` de mapi v0.x.
  3. Mapea columnas (la mayoría se llaman igual; campos nuevos se inicializan default).
  4. INSERT en `bvcpas-project` (`clients` + `intuit_tokens`). Los `*_encrypted` se copian sin tocar (misma `ENCRYPTION_KEY`).
  5. Verifica counts: 77 clientes en mapi v0.x → 77 en bvcpas-project.
- Run secuencial: primero local (mapi v0.x local → bvcpas local) para validar, luego prod cuando el operador autorice.
- One-shot. Idempotente: si re-correr, detecta clientes ya migrados (por `qbo_realm_id`) y los skipea con report.

---

## Pre-requisitos para arrancar v0.3.0

- ✅ `00-foundation` cerrado.
- ✅ `10-core-auth` cerrado (necesario porque endpoints requieren admin role + `actor_user_id` en eventos).
- ⏳ Variables nuevas en `.env`: `ENCRYPTION_KEY`, `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `INTUIT_REDIRECT_URI`. Para local, copiar las de mapi v0.x. Para prod, configurar en panel Coolify.
- ⏳ Redis disponible (ya está desde foundation).

---

## Notas

- **Heredado de mapi v0.x con renames mínimos.** Naming de tablas idéntico (`intuit_tokens`, `clients`). Endpoints solo cambian `authorize` → `connect` (preferencia operador) y se quita prefijo `/admin/` (regla nueva bvcpas).
- **Misma encryption key**: la migración no decripta + reencripta. Cuando mapi v0.x se apague tras la migración, la key queda exclusiva de bvcpas-project.
- **Auto-deploy en push a main.** Cuando v0.3.0 cierre, Coolify deploy automático. Las env vars nuevas hay que agregarlas al panel ANTES del push del cierre, sino el deploy falla por config Zod.
- **Tests Tipo B con Intuit real son imposibles** (requeriría OAuth real con Intuit Developer). Los smoke tests usan mocks del SDK `intuit-oauth` y stubs HTTP.
- **Cuando entre `21-intuit-bridge` y `22-connectors`** después, este módulo no cambia — el proxy genérico `/v1/intuit/:realmId/call` se vuelve la base que esos módulos consumen.
