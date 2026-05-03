# 10-core-auth — Auth (users + JWT + sesiones revocables)

**App:** mapi
**Status:** ✅ Completo
**Versiones que lo construyen:** [v0.2.0](v0.2.0.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este módulo

bvcpas-project no es un sistema de un solo usuario. Aunque el operador es el único developer, los **dashboards reemplazan Google Sheets que hoy se comparten con varias personas** del equipo (compliance, CPAs externos, asistentes). Cada uno tiene que entrar a ver datos con su propio login.

Además, varios módulos de Etapa 1 tienen lógica de **asignación a usuarios**:

- M3 Customer Support tiene columna `Owner` (encargado de cliente).
- M6 1099 Dashboard tiene columna `Owner`.
- M2 Uncats: cuando alguien edita una nota, queremos saber quién la editó.
- `event_log` necesita `actor_user_id` real desde el día 1, no `null` con parche futuro.

Sin este módulo, todo lo demás queda con auth ficticia, owner como label libre, y auditoría incompleta. Por eso `10-core-auth` va antes que `11-clients`, antes de `20-intuit/01-oauth`, y antes de cualquier Mx.

Granularidad de roles arranca minimal: `admin` (tú) y `viewer` (todos los demás, solo lectura). Si en el futuro entra rol `bookkeeper` (puede operar clientes asignados), se agrega como decisión nueva en su versión.

---

## Alcance

### Sí entra

- Tabla `users` con: id, email, password_hash, full_name, role, status, last_login_at, timestamps.
- Tabla `user_sessions` para sesiones revocables granular (logout específico, sesión robada).
- Encryption helper para password hashing (bcrypt, heredado de mapi v0.x).
- Configuración: `JWT_SECRET`, `JWT_EXPIRES_IN` en env vars validadas.
- Endpoints `/v1/auth/*`: login, logout, logout-all, me.
- Endpoints `/v1/admin/users/*`: CRUD + sessions management.
- Guards: `JwtAuthGuard` (verifica JWT + sesión activa), `RolesGuard` (verifica role admin/viewer), reuso del `@Public()` decorator de `00-foundation`.
- Cache Redis (TTL 30s) para verificación de sesión activa por request — evita query DB en cada request.
- Eventos `event_log`: login success/failed, logout, sesión revocada, user creado/editado/disabled, password reset.
- Errores de dominio: USER_NOT_FOUND, EMAIL_ALREADY_EXISTS, INVALID_CREDENTIALS, USER_DISABLED, SESSION_REVOKED, SESSION_EXPIRED, INSUFFICIENT_PERMISSIONS.
- Seed inicial: 1 user `admin` (operador) creado al migrar primera vez. Password inicial generada y mostrada en logs UNA sola vez (operador la cambia al primer login).

### NO entra

- **Recovery de password por email.** Diferido. El admin asigna password inicial; el user la cambia al primer login. Sin reset email hasta que un Mx lo pida.
- **TOTP / 2FA.** Diferido a BACKLOG con trigger "cuando un viewer tenga datos sensibles a su nombre" o cuando el operador lo pida.
- **OAuth social** (Google, etc.). Diferido. Login solo email + password.
- **Multi-tenant.** El proyecto es de un solo dueño (operador), no SaaS. No hay `organization_id` ni similar.
- **Rol `bookkeeper`** (operador con clientes asignados). Diferido — entra cuando un Mx requiera scoping (probablemente M3 si el equipo crece).
- **UI de login y gestión.** Vive en `apps/bvcpas/roadmap/10-core-ui/` — entra cuando bvcpas tenga stack visual decidido.
- **Audit log de IP geolocation, device fingerprint avanzado.** El módulo guarda `ip` y `user_agent` raw. Análisis avanzado se difiere.

---

## Naming visible al operador (NAM-1)

### Tabla `users`

| Columna         | Tipo        | Constraint                                  | Notas                             |
| --------------- | ----------- | ------------------------------------------- | --------------------------------- |
| `id`            | UUID        | PK, default `gen_random_uuid()`             |                                   |
| `email`         | TEXT        | NOT NULL, UNIQUE                            | lowercase, validado con Zod       |
| `password_hash` | TEXT        | NOT NULL                                    | bcrypt cost 12                    |
| `full_name`     | TEXT        | NOT NULL                                    | "Alfredo Guerrero"                |
| `role`          | TEXT        | NOT NULL, CHECK in enum                     | `'admin'` \| `'viewer'`           |
| `status`        | TEXT        | NOT NULL, default `'active'`, CHECK in enum | `'active'` \| `'disabled'`        |
| `last_login_at` | TIMESTAMPTZ | NULL                                        | actualizado en cada login exitoso |
| `created_at`    | TIMESTAMPTZ | NOT NULL, default `now()`                   |                                   |
| `updated_at`    | TIMESTAMPTZ | NOT NULL, default `now()`                   | trigger actualiza en cada UPDATE  |

**Índices:** `email` (UNIQUE ya implícito), `(status, role)` para queries de listado.

### Tabla `user_sessions`

| Columna        | Tipo        | Constraint                                 | Notas                                                       |
| -------------- | ----------- | ------------------------------------------ | ----------------------------------------------------------- |
| `id`           | UUID        | PK, default `gen_random_uuid()`            |                                                             |
| `user_id`      | UUID        | NOT NULL, FK `users(id)` ON DELETE CASCADE | sesión muere con el user                                    |
| `jti`          | UUID        | NOT NULL, UNIQUE                           | JWT ID claim, lo que el middleware busca                    |
| `user_agent`   | TEXT        | NULL                                       | "Chrome 130 / Windows 11"                                   |
| `ip`           | TEXT        | NULL                                       | IP del login (informativo, no se valida en cada request)    |
| `created_at`   | TIMESTAMPTZ | NOT NULL, default `now()`                  | timestamp del login                                         |
| `last_seen_at` | TIMESTAMPTZ | NOT NULL, default `now()`                  | actualizado en cada request autenticado (debounced 5min)    |
| `revoked_at`   | TIMESTAMPTZ | NULL                                       | NULL = activa, valor = revocada                             |
| `expires_at`   | TIMESTAMPTZ | NOT NULL                                   | coincide con expiry del JWT (`created_at + JWT_EXPIRES_IN`) |

**Índices:** `user_id`, `jti`.

### Endpoints

#### `/v1/auth/*` — usuario logged interactúa con su propia sesión

| Method | Path                   | Auth        | Descripción                                                    |
| ------ | ---------------------- | ----------- | -------------------------------------------------------------- |
| POST   | `/v1/auth/login`       | `@Public()` | email + password → JWT + datos de user                         |
| POST   | `/v1/auth/logout`      | JWT         | revoca SOLO la sesión actual (la del JWT que mandó la request) |
| POST   | `/v1/auth/logout-all`  | JWT         | revoca TODAS las sesiones del user (útil si pierde laptop)     |
| GET    | `/v1/auth/me`          | JWT         | datos del user actual (id, email, full_name, role, status)     |
| PATCH  | `/v1/auth/me/password` | JWT         | cambia password del user actual (requiere old_password)        |

#### `/v1/admin/users/*` — solo admin gestiona users

| Method | Path                                      | Auth        | Descripción                                                   |
| ------ | ----------------------------------------- | ----------- | ------------------------------------------------------------- |
| GET    | `/v1/admin/users`                         | JWT + admin | lista todos los users con paginación                          |
| POST   | `/v1/admin/users`                         | JWT + admin | crea user nuevo (email + full_name + role + initial password) |
| GET    | `/v1/admin/users/:id`                     | JWT + admin | detalle de un user                                            |
| PATCH  | `/v1/admin/users/:id`                     | JWT + admin | edita full_name, role, status (NO password)                   |
| POST   | `/v1/admin/users/:id/reset-password`      | JWT + admin | asigna password nueva (forzada)                               |
| GET    | `/v1/admin/users/:id/sessions`            | JWT + admin | lista sesiones del user (activas + revocadas)                 |
| POST   | `/v1/admin/users/:id/sessions/revoke-all` | JWT + admin | revoca TODAS las sesiones del user                            |

#### `/v1/admin/sessions/*` — gestión de sesiones individuales

| Method | Path                            | Auth        | Descripción                  |
| ------ | ------------------------------- | ----------- | ---------------------------- |
| PATCH  | `/v1/admin/sessions/:id/revoke` | JWT + admin | revoca UNA sesión específica |

### Errores de dominio

Todos heredan de `DomainError` (`00-foundation`). Mapping en `domain-error.filter.ts`:

| Code                       | HTTP | Cuándo se lanza                                         |
| -------------------------- | ---- | ------------------------------------------------------- |
| `USER_NOT_FOUND`           | 404  | GET/PATCH `/admin/users/:id` con id que no existe       |
| `EMAIL_ALREADY_EXISTS`     | 409  | POST `/admin/users` con email ya usado                  |
| `INVALID_CREDENTIALS`      | 401  | login con email no existe o password no matchea         |
| `USER_DISABLED`            | 401  | JWT válido pero `users.status='disabled'`               |
| `SESSION_REVOKED`          | 401  | JWT válido pero `user_sessions.revoked_at IS NOT NULL`  |
| `SESSION_EXPIRED`          | 401  | JWT válido pero `user_sessions.expires_at < now()`      |
| `SESSION_NOT_FOUND`        | 404  | revoke a sesión que no existe (defensa)                 |
| `INSUFFICIENT_PERMISSIONS` | 403  | viewer intentando endpoint admin                        |
| `WEAK_PASSWORD`            | 400  | password < 8 caracteres o no cumple política            |
| `WRONG_OLD_PASSWORD`       | 400  | PATCH `/auth/me/password` con `old_password` incorrecto |

### Eventos `event_log`

Todos siguen convención `<dominio>.<recurso>.<acción>`. Heredado de mapi v0.x.

| Event type                         | Cuándo se dispara                                | Payload (jsonb)                                |
| ---------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `auth.user.created`                | POST `/admin/users` exitoso                      | `{ user_id, email, role, created_by_user_id }` |
| `auth.user.updated`                | PATCH `/admin/users/:id` (cambia role/full_name) | `{ user_id, changes, updated_by_user_id }`     |
| `auth.user.disabled`               | PATCH `/admin/users/:id` con status=disabled     | `{ user_id, disabled_by_user_id }`             |
| `auth.user.enabled`                | PATCH `/admin/users/:id` con status=active       | `{ user_id, enabled_by_user_id }`              |
| `auth.user.password_reset`         | POST `/admin/users/:id/reset-password`           | `{ user_id, reset_by_user_id }`                |
| `auth.user.password_changed`       | PATCH `/auth/me/password`                        | `{ user_id }` (self)                           |
| `auth.login.success`               | POST `/auth/login` OK                            | `{ user_id, ip, user_agent }`                  |
| `auth.login.failed`                | POST `/auth/login` falla                         | `{ email, reason, ip }` (sin user_id)          |
| `auth.logout`                      | POST `/auth/logout`                              | `{ user_id, session_id }`                      |
| `auth.logout_all`                  | POST `/auth/logout-all`                          | `{ user_id, sessions_revoked_count }`          |
| `auth.session.revoked_by_admin`    | PATCH `/admin/sessions/:id/revoke`               | `{ session_id, user_id, revoked_by_user_id }`  |
| `auth.session.revoke_all_by_admin` | POST `/admin/users/:id/sessions/revoke-all`      | `{ user_id, revoked_by_user_id, count }`       |

### Configuración / env vars nuevas

| Variable                  | Tipo            | Required     | Default | Notas                                |
| ------------------------- | --------------- | ------------ | ------- | ------------------------------------ |
| `JWT_SECRET`              | string min 32   | Sí           | —       | clave HMAC para firmar JWTs          |
| `JWT_EXPIRES_IN`          | string duration | No           | `7d`    | formato de `ms` (`7d`, `12h`, `30m`) |
| `BCRYPT_COST`             | number 10-14    | No           | `12`    | rounds de bcrypt                     |
| `INITIAL_ADMIN_EMAIL`     | email           | Solo en seed | —       | email del admin inicial (operador)   |
| `INITIAL_ADMIN_FULL_NAME` | string          | Solo en seed | —       | "Alfredo Guerrero"                   |

`INITIAL_ADMIN_*` solo se leen en el seed de la primera migration. La password inicial se **genera aleatoriamente** y se loguea UNA sola vez (operador la cambia al primer login). No se persiste en `.env`.

---

## Flujos de runtime

### Flujo 1 — Login exitoso (happy path)

1. Cliente (frontend o herramienta) hace `POST /v1/auth/login` con body `{ email, password }`.
2. Backend busca el user por email. Si no existe → `INVALID_CREDENTIALS` (401).
3. Si existe, compara `password` con `password_hash` usando bcrypt.
4. Si no matchea → `INVALID_CREDENTIALS` (401) + evento `auth.login.failed`.
5. Si matchea pero `status='disabled'` → `USER_DISABLED` (401) + evento `auth.login.failed` con reason=disabled.
6. Si todo OK:
   - Genera UUID nuevo para `jti`.
   - Inserta row en `user_sessions` con: `user_id`, `jti`, `user_agent` (del header), `ip` (del request), `created_at=now()`, `expires_at=now()+JWT_EXPIRES_IN`.
   - Firma JWT con claims: `{ sub: user_id, email, role, jti, exp }`.
   - Actualiza `users.last_login_at = now()`.
   - Dispara evento `auth.login.success`.
   - Devuelve `{ access_token: <jwt>, user: { id, email, full_name, role } }`.

### Flujo 2 — Request autenticado (cualquier endpoint con JWT)

1. Cliente manda request con header `Authorization: Bearer <jwt>`.
2. `JwtAuthGuard`:
   - Valida firma del JWT con `JWT_SECRET`. Si firma inválida → `UNAUTHORIZED` (401).
   - Lee claim `jti` del JWT.
   - Consulta cache Redis con key `session:<jti>` (TTL 30s).
3. Si Redis miss:
   - Query DB: `SELECT user_id, revoked_at, expires_at FROM user_sessions WHERE jti = ?`.
   - Si no existe → `SESSION_NOT_FOUND` (401).
   - Si `revoked_at IS NOT NULL` → `SESSION_REVOKED` (401).
   - Si `expires_at < now()` → `SESSION_EXPIRED` (401).
   - Si OK, JOIN con `users`: si `users.status='disabled'` → `USER_DISABLED` (401).
   - Si OK, escribe en cache Redis: `session:<jti>` con valor `{ user_id, role, status, expires_at }` y TTL 30s.
4. Si Redis hit:
   - Verifica `expires_at` (puede haber pasado durante los 30s del cache → `SESSION_EXPIRED`).
   - El `revoked_at` NO se chequea desde cache (cache no tiene info de revocación). El TTL 30s garantiza que máximo 30s después de revocar, el cache caduca y la próxima request golpea DB y ve la revocación.
   - **Trade-off:** revocar tarda **máximo 30s** en propagar (no es instantáneo). Aceptable para el caso operativo. Si se necesita instantáneo, se invalida la key Redis explícitamente al revocar (ver Decisiones operativas).
5. Si todo OK, inyecta `req.user = { id, email, role }` y deja pasar al controller.
6. Endpoint con `@Roles('admin')` adicional verifica `req.user.role`. Si no matchea → `INSUFFICIENT_PERMISSIONS` (403).
7. Async: actualiza `user_sessions.last_seen_at = now()` con debounce de 5 minutos (no en cada request, solo si han pasado >5min desde última actualización). Reduce write load en DB.

### Flujo 3 — Logout normal

1. Cliente hace `POST /v1/auth/logout` con su JWT.
2. `JwtAuthGuard` valida JWT (mismo flujo 2).
3. Service marca `user_sessions.revoked_at = now()` para el `jti` del JWT actual.
4. Invalida cache Redis: `DEL session:<jti>`.
5. Dispara evento `auth.logout`.
6. Devuelve 204 No Content. El frontend borra el JWT de cookie/localStorage.
7. Si el JWT viajara a otro request después del logout, golpea DB (cache invalidado) → `SESSION_REVOKED` (401).

### Flujo 4 — Logout de TODAS las sesiones (laptop perdido)

1. Cliente (user normal) hace `POST /v1/auth/logout-all` con su JWT actual.
2. Service hace `UPDATE user_sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL`.
3. Invalida TODAS las keys Redis: `DEL session:<jti>` para cada sesión revocada.
4. Dispara evento `auth.logout_all` con `sessions_revoked_count`.
5. La sesión actual queda revocada también (la próxima request del cliente que llamó este endpoint también va a fallar — esperado, debe re-loguearse).

### Flujo 5 — Admin revoca sesión específica de otro user

1. Admin entra a UI (futuro `bvcpas/10-core-ui`), ve lista de sesiones de un user con `GET /v1/admin/users/:id/sessions`.
2. Click "Revocar" en la sesión sospechosa → frontend hace `PATCH /v1/admin/sessions/:session_id/revoke`.
3. `RolesGuard` verifica que el caller sea `admin`. Si no → `INSUFFICIENT_PERMISSIONS` (403).
4. Service marca la sesión específica como revocada + invalida cache Redis.
5. Dispara evento `auth.session.revoked_by_admin`.
6. La próxima request del user (en ese dispositivo) → `SESSION_REVOKED` (401), debe re-loguearse.

### Flujo 6 — Admin revoca TODAS las sesiones de un user

1. Admin hace `POST /v1/admin/users/:id/sessions/revoke-all`.
2. `RolesGuard` verifica admin.
3. Service revoca todas las sesiones del user + invalida cache.
4. Dispara `auth.session.revoke_all_by_admin`.
5. El user queda forzado a re-loguearse en TODOS sus dispositivos.

### Flujo 7 — Despido permanente (combinación)

1. Admin hace `POST /v1/admin/users/:id/sessions/revoke-all` (revoca todo lo activo).
2. Admin hace `PATCH /v1/admin/users/:id` con `{ status: 'disabled' }` (deshabilita el user).
3. Eventos: `auth.session.revoke_all_by_admin` + `auth.user.disabled`.
4. Resultado:
   - Sesiones existentes → 401 inmediato (revocadas).
   - Si alguien intenta loguearse con credenciales del user → 401 `USER_DISABLED`.
   - Reactivar al user en el futuro: `PATCH /v1/admin/users/:id` con `{ status: 'active' }` + reset password. Las sesiones viejas siguen revocadas (no se reactivan).

### Flujo 8 — Cambio de password por self-service

1. User hace `PATCH /v1/auth/me/password` con `{ old_password, new_password }`.
2. Backend compara `old_password` con `password_hash` actual.
3. Si no matchea → `WRONG_OLD_PASSWORD` (400).
4. Valida `new_password` contra política (mínimo 8 chars, etc.). Si falla → `WEAK_PASSWORD` (400).
5. Genera nuevo `password_hash` con bcrypt.
6. UPDATE `users.password_hash`.
7. **Decisión por discutir:** ¿cambiar password revoca otras sesiones? Mi voto: SÍ — revoca todas las sesiones del user (excepto la actual) por seguridad. Si el user perdió laptop y al recuperar acceso cambia password, las sesiones del laptop quedan muertas automáticamente.
8. Dispara evento `auth.user.password_changed`.

### Flujo 9 — Reset de password forzado por admin

1. Admin hace `POST /v1/admin/users/:id/reset-password`.
2. Service genera password aleatoria (16 chars, alfanumérica).
3. UPDATE `users.password_hash` con bcrypt de la nueva.
4. Revoca TODAS las sesiones del user (forzar re-login con nueva password).
5. Devuelve `{ temporary_password: "abc..." }` al admin **una sola vez** (no se guarda en logs).
6. Admin se la pasa al user por canal seguro (Telegram, persona, etc.).
7. Dispara evento `auth.user.password_reset`.
8. User entra con la temporary, **debe** cambiarla en su primer flujo (UI lo va a forzar — eso vive en `bvcpas/10-core-ui`).

---

## Decisiones operativas

### `users.status='disabled'` vs `user_sessions.revoked_at`

| Mecanismo                  | Cuándo usarlo                                                              |
| -------------------------- | -------------------------------------------------------------------------- |
| `users.status='disabled'`  | Despido permanente. Bloquea cualquier login futuro.                        |
| `user_sessions.revoked_at` | Logout, sesión específica robada, forzar re-login tras cambio de password. |

**Despido permanente real:** combinas las dos. Revoca todas las sesiones (mata lo activo) + disable el user (impide nuevo login). Belt and suspenders.

**Re-contratación:** poner `status='active'` + reset password. Las sesiones viejas no se reactivan (siguen revocadas).

### Cache Redis 30s — trade-off de propagación

Revocar una sesión tarda **máximo 30 segundos** en propagar (mientras el cache caduca). Aceptable porque:

- Para despidos: no es crítico que sea instantáneo (~30s no abre puerta a daño real).
- Para sesiones robadas: el ladrón tiene que estar haciendo requests activos en esos 30s para "aprovecharse". El admin debería deshabilitar también el user para cubrir el caso peor.
- Sin cache: cada request golpea DB para verificar sesión = costo prohibitivo en dashboards con muchas requests por minuto.

**Mitigación:** invalidar cache explícitamente al revocar. Cuando se revoca una sesión, además de marcar DB se hace `DEL session:<jti>` en Redis. Esto baja el tiempo de propagación a 0s para el caso "yo (admin) revoco". El TTL solo aplica si por alguna razón la operación de invalidación falla (ej. Redis caído momentáneamente) — el sistema sigue siendo correcto pero más lento.

### Política de password

Mínima razonable:

- Mínimo 8 caracteres.
- Sin reglas tontas tipo "debe tener mayúscula y número y símbolo" (las complican y los users hacen `Abc12345!` cumpliendo regla pero predecibles).
- **Bloquear passwords comunes** (top 10000 del listado público de breached passwords) — entra como diferido si se vuelve necesario. Mientras tanto, los users del operador son personas confiables que no van a usar `password123`.

### `INITIAL_ADMIN_EMAIL` — seed inicial

Cuando se corre la primera migration con tablas `users`/`user_sessions` vacías, el seed:

1. Lee `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_FULL_NAME` del `.env` (validados Zod, requeridos solo en este caso).
2. Genera password aleatoria de 24 chars.
3. Inserta user con role=admin, status=active.
4. Imprime en logs: `[seed] Admin creado: <email>. Password inicial: <random>. CAMBIARLA AL PRIMER LOGIN.`.
5. **El password NO se persiste** en ningún archivo. Si se pierde antes del primer login, hay que correr migration de reset (futuro) o entrar a DB directo y resetear hash.

---

## Estrategia de tests

No todos los tests valen lo mismo. En este proyecto hay 2 tipos con costos y valor distintos.

### Tipo A — Lógica pura con fixtures JSON (mayoría)

La mayor parte de los CR (CR-auth-001 a CR-auth-051) se cubren con tests **unit que NO tocan DB**. Los services reciben mocks de los repositorios; los repositorios reciben fixtures JSON capturados de queries reales.

**Costo:** milisegundos por test. Permiten ciclo TDD-first real (escribir test rojo → operador valida → implementar verde → siguiente CR) sin esperar setup de Postgres.

**Cubren:** lógica de services, transformaciones, decisiones de negocio, validaciones, mapeo de errores de dominio.

**NO cubren:** que la query SQL devuelve lo correcto, que constraints UNIQUE disparen, que triggers se ejecuten, race conditions reales.

**Ubicación:**

- Tests: `apps/mapi/test/unit/<area>/<archivo>.spec.ts`.
- Fixtures: `apps/mapi/test/fixtures/<area>/<caso>.json`.

**Cómo se captura un fixture JSON:**

1. Levantar DB local con datos representativos del caso.
2. Correr la query exacta del service desde Drizzle Studio o psql.
3. Copiar el JSON resultante a `test/fixtures/<area>/<caso>.json`.
4. Importarlo en el test como mock del retorno del repo.
5. Si la query cambia: regenerar el JSON, los tests siguen rápidos.

### Tipo B — Smoke tests con DB real (pocos)

Solo 3-5 tests por módulo. Cubren los flujos end-to-end completos: HTTP request → controller → service → repo → DB → response. Postgres real (`mapi_test`), migrations aplicadas, seed mínimo.

**Costo:** segundos por test (setup + teardown). Suite completa puede tomar minutos. Por eso son pocos.

**Cubren:** que las queries SQL funcionan en runtime, que constraints disparan, que triggers se ejecutan, que cascade deletes operan, que el JOIN entre `users` y `user_sessions` retorna lo esperado.

**NO cubren ni duplican:** lo que Tipo A ya validó (lógica pura, mappers, validaciones). Si rompes lógica pura, los Tipo A te avisan en milisegundos. Los Tipo B existen para garantizar que la integración con DB no se rompió.

**Ubicación:** `apps/mapi/test/e2e/<area>.e2e-spec.ts`.

### Reglas duras

1. **Cada CR del listado de "Tests críticos" tiene un test real.** Si no es testeable, el CR está mal escrito.
2. **Cero tests decorativos** (D-mapi-005 heredado). Si rompes la lógica y el test no falla, el test no sirve. Se borra.
3. **Tipo A primero, Tipo B solo para smoke.** No duplicar la misma validación en ambos tipos.
4. **Fixture nunca se inventa.** Siempre se captura de query real, aunque sea una vez.
5. **El JSON del fixture es válido.** Si la API de Drizzle cambia y el shape ya no es válido, regenerar el fixture.

---

## Tests críticos

Comportamientos que el módulo DEBE garantizar siempre. Cada uno es un test real (Tipo A o B). Cuando se abra `v0.2.0.md`, los TODOs de tests apuntan a estos códigos.

### Login (Tipo A)

- **CR-auth-001:** Login con email no existente → 401 INVALID_CREDENTIALS. No revela si el email existe (mismo error que password incorrecto).
- **CR-auth-002:** Login con password incorrecto → 401 INVALID_CREDENTIALS.
- **CR-auth-003:** Login con user `disabled` → 401 USER_DISABLED. No INVALID_CREDENTIALS (admin necesita saber si el bloqueo es por password o por status para soporte).
- **CR-auth-004:** Login exitoso devuelve JWT firmado con claim `jti` válido y crea row en `user_sessions` con ese `jti`.
- **CR-auth-005:** Login exitoso actualiza `users.last_login_at = now()`.
- **CR-auth-006:** Login dispara evento `auth.login.success` con `actor_user_id`, `ip`, `user_agent`.
- **CR-auth-007:** Login fallido dispara evento `auth.login.failed` con email + razón, SIN `actor_user_id` (no hay user autenticado).

### Sesión (Tipo A + B)

- **CR-auth-010:** JWT con firma inválida → 401. Protege contra forgery. _(Tipo A)_
- **CR-auth-011:** JWT válido pero `jti` no existe en `user_sessions` → 401 SESSION*NOT_FOUND. *(Tipo A)\_
- **CR-auth-012:** JWT válido + `revoked_at` poblado → 401 SESSION*REVOKED. *(Tipo A)\_
- **CR-auth-013:** JWT válido + `expires_at < now()` → 401 SESSION*EXPIRED. *(Tipo A)\_
- **CR-auth-014:** Revocar sesión + invalidar cache Redis → próxima request falla inmediato (no espera 30s). _(Tipo A con mock Redis)_
- **CR-auth-015:** Revocar sesión sin invalidar cache → falla en máximo 30s (TTL del cache). _(Tipo A con clock manipulado + mock Redis)_
- **CR-auth-016:** `last_seen_at` se actualiza con debounce 5min, no en cada request. _(Tipo A con clock)_

### Roles y guards (Tipo A)

- **CR-auth-020:** viewer hace request a endpoint admin → 403 INSUFFICIENT_PERMISSIONS.
- **CR-auth-021:** admin hace request a endpoint admin → pasa.
- **CR-auth-022:** Endpoint marcado `@Public()` no requiere JWT (login es el caso de uso real).

### Password (Tipo A)

- **CR-auth-030:** Cambio de password con `old_password` incorrecto → 400 WRONG_OLD_PASSWORD.
- **CR-auth-031:** Cambio de password OK → revoca todas las otras sesiones del user (excepto la actual).
- **CR-auth-032:** Reset admin → genera password aleatoria, revoca TODAS las sesiones del user (incluida la del admin si fuera el mismo user — caso degenerado pero válido).
- **CR-auth-033:** Password < 8 chars → 400 WEAK_PASSWORD.
- **CR-auth-034:** Hash bcrypt no es reversible: `compare(plain, hash)` retorna boolean, nunca el plain.

### Auditoría event_log (Tipo A)

- **CR-auth-040:** Cada login exitoso dispara `auth.login.success` con `actor_user_id` correcto. _(ya cubierto en CR-auth-006, listado aquí para reforzar dominio "auditoría".)_
- **CR-auth-041:** Revocar sesión por admin dispara `auth.session.revoked_by_admin` con `revoked_by_user_id` = id del admin que revocó.
- **CR-auth-042:** Disable user dispara `auth.user.disabled` con `disabled_by_user_id`.
- **CR-auth-043:** Si `EventLogService.log()` falla internamente, NO rompe la operación principal (login completa OK aunque event_log falle — D-052 mapi v0.x).

### Concurrencia y constraints (Tipo B)

- **CR-auth-050:** Crear user con email duplicado en race condition → solo uno gana, el otro recibe 409 EMAIL_ALREADY_EXISTS (constraint UNIQUE de DB cubre, no try/catch en service).
- **CR-auth-051:** Login simultáneo del mismo user en 2 dispositivos → crea 2 sesiones distintas con `jti` distintos. Ambas funcionan independientes.

### Smoke tests (Tipo B)

- **SMK-auth-001:** Flujo completo despido — admin crea user → user loguea → admin revoca todas + disable → user no puede entrar (ni con JWT viejo ni con nuevo login).
- **SMK-auth-002:** Cache Redis 30s — revoco sin invalidar cache, request en t<30s pasa, request en t>30s falla. Validar que el TTL realmente funciona en runtime.
- **SMK-auth-003:** UNIQUE constraint email — 2 inserts simultáneos vía endpoint, uno gana, otro recibe 409. (Complementa CR-auth-050 con HTTP real.)
- **SMK-auth-004:** Cascade delete — DELETE user borra sus `user_sessions` automáticamente sin error.
- **SMK-auth-005:** Migration end-to-end — corre `npm run db:migrate` en DB vacía, seed crea admin con `INITIAL_ADMIN_*`, login con esas credenciales funciona.

---

## Cómo se trabaja el módulo (TDD-first)

Cada CR del listado es el orden del trabajo en `v0.2.0.md` (no anexo posthoc).

Por cada CR:

1. **Escribo el test** (Tipo A o B según el área) — corre y queda **rojo** (la implementación todavía no existe).
2. **Operador ve el rojo**, valida que el test esté bien diseñado (cubre lo correcto, no es decorativo, no testea implementación interna).
3. **Implemento mínimo para pasar a verde.** Sin agregar features no pedidas ("ya que estamos" prohibido).
4. **Operador ve el verde**, valida.
5. **Siguiente CR.**

Operador tiene `npm run test:watch` corriendo. Los Tipo A re-corren en milisegundos. Los Tipo B se corren bajo demanda con `npm run test:e2e` (o al cierre de un grupo de CRs relacionados).

**Si durante la implementación aparece una decisión no prevista en el TDD:**

Paro y pregunto. No improviso. Las decisiones nuevas se documentan como `D-mapi-NNN` en `v0.2.0.md` antes de avanzar.

---

## Tareas

Cada bullet es una tarea o sub-tarea. Granularidad: lo más pequeño que tiene sentido revisar solo.

### Schema + migration

- [ ] Schema `users` en Drizzle con todas las columnas (NAM-1 aprobado).
- [ ] Schema `user_sessions` en Drizzle.
- [ ] Migration `0001_users.sql` generada por drizzle-kit.
- [ ] Trigger `users.updated_at` automático en cada UPDATE.
- [ ] Seed que crea admin inicial leyendo `INITIAL_ADMIN_*` env vars.

### Core auth infrastructure

- [ ] Module `core/auth/` con providers: `JwtService`, `PasswordService` (wrapper bcrypt), `SessionsService` (Redis + DB).
- [ ] `JwtService.sign(payload)` y `JwtService.verify(token)` usando `JWT_SECRET`.
- [ ] `PasswordService.hash(plain)` y `PasswordService.compare(plain, hash)` con bcrypt cost 12.
- [ ] `SessionsService.create(user, userAgent, ip)` que crea row + JWT firmado.
- [ ] `SessionsService.verify(jti)` con cache Redis 30s + fallback DB.
- [ ] `SessionsService.revoke(jti)` que marca `revoked_at` + invalida Redis.
- [ ] `SessionsService.revokeAllForUser(userId)` que revoca todas + invalida Redis.

### Guards + decorators

- [ ] `JwtAuthGuard` global que aplica a TODOS los endpoints excepto `@Public()`.
- [ ] `RolesGuard` que verifica `@Roles('admin')` decorator.
- [ ] `@Roles('admin' | 'viewer')` decorator.
- [ ] `@CurrentUser()` decorator que extrae `req.user`.

### Module `auth/` (endpoints `/v1/auth/*`)

- [ ] `AuthController` con: login, logout, logout-all, me, password change.
- [ ] `LoginDto` Zod (email + password con validaciones).
- [ ] `LoginResponseDto` con `createZodDto`.
- [ ] `MeResponseDto`.
- [ ] `ChangePasswordDto`.
- [ ] Rate limit en `/v1/auth/login` (max 10 intentos/min por IP, evitar brute force) — heredar de paquete `@nestjs/throttler` cuando se necesite.

### Module `admin/users/` (endpoints `/v1/admin/users/*`)

- [ ] `AdminUsersController` con: list, create, getOne, update, resetPassword.
- [ ] `CreateUserDto`, `UpdateUserDto`.
- [ ] `UserDto` (response shape, sin password_hash).
- [ ] `AdminUsersSessionsController` con: listSessions, revokeAll.

### Module `admin/sessions/`

- [ ] `AdminSessionsController` con: revoke single.
- [ ] `SessionDto` (response shape: id, user_agent, ip, created_at, last_seen_at, revoked_at).

### Eventos `event_log`

> En este módulo se introduce `event_log`. Tabla mínima + service:

- [ ] Schema `event_log` con id, event_type, actor_user_id, payload (jsonb), created_at.
- [ ] Migration `0002_event_log.sql`.
- [ ] `EventLogService.log(eventType, payload, actorUserId?)` que inserta async (swallow errors, no bloquea operación principal — heredado D-052 mapi v0.x).
- [ ] Llamadas a `EventLogService.log()` en cada flujo descrito arriba.

### Errores de dominio

- [ ] Clases `UserNotFoundError`, `EmailAlreadyExistsError`, etc. extendiendo `DomainError`.
- [ ] Mapping en `domain-error.filter.ts` de cada code → HTTP status.

### Tests

> El detalle de qué archivos de tests escribir vive en `v0.2.0.md` (cuando se abra). Aquí solo el mapeo conceptual.
>
> **Tipo A (lógica pura con fixtures JSON):** cubre CR-auth-001 a CR-auth-049. La mayoría.
>
> **Tipo B (smoke con DB real):** cubre CR-auth-050, CR-auth-051 y SMK-auth-001 a SMK-auth-005. Solo flujos end-to-end.

- [ ] Setup `apps/mapi/test/fixtures/auth/` con fixtures iniciales (user-active, user-disabled, session-active, session-revoked).
- [ ] Setup `apps/mapi/test/unit/auth/` para tests Tipo A.
- [ ] Setup `apps/mapi/test/e2e/auth.e2e-spec.ts` para tests Tipo B.
- [ ] Tests Tipo A para CR-auth-001 a CR-auth-049 (orden TDD-first, cada CR es 1 commit potencial).
- [ ] Tests Tipo B para CR-auth-050, CR-auth-051 y SMK-auth-001 a SMK-auth-005.
- [ ] CI/local: `npm run test:watch` corre todos los Tipo A en <2s. `npm run test:e2e` corre Tipo B en <30s.

### Documentación

- [ ] OpenAPI tags `Auth` y `Admin / Users` y `Admin / Sessions` con descriptions completas (DOC-1 a DOC-8 heredadas del foundation).
- [ ] Cada endpoint con `@ApiOperation` + `@ApiResponse` + DTOs Zod descritos con `.describe()`.

### Cierre versión

- [ ] Bumpear `apps/mapi/package.json` a versión correspondiente (ej. v0.2.0).
- [ ] Smoke test del módulo (ver más abajo).
- [ ] Tag `mapi-v0.2.0` y push.
- [ ] Marcar este TDD como ✅ en su README + tabla del `apps/mapi/roadmap/README.md`.

---

## Smoke test del módulo

Cuando todas las tareas estén `[x]` y el operador valida manualmente:

- [ ] Levantar mapi local. En logs aparece "Admin creado: alfredo@... Password inicial: xyz".
- [ ] `POST /v1/auth/login` con email del admin y la password generada → recibe JWT.
- [ ] `GET /v1/auth/me` con el JWT → devuelve datos del admin.
- [ ] `PATCH /v1/auth/me/password` cambia password → la nueva password funciona, la vieja ya no.
- [ ] `POST /v1/admin/users` crea un viewer de prueba.
- [ ] Login con el viewer → recibe JWT con `role=viewer`.
- [ ] Viewer hace `GET /v1/admin/users` → recibe 403 `INSUFFICIENT_PERMISSIONS`.
- [ ] Admin hace `GET /v1/admin/users/:viewer_id/sessions` → ve la sesión activa del viewer.
- [ ] Admin revoca sesión del viewer → próxima request del viewer falla con 401 `SESSION_REVOKED` (en máximo 30s).
- [ ] Admin deshabilita al viewer (`status='disabled'`) → intento de nuevo login → 401 `USER_DISABLED`.
- [ ] `event_log` muestra todos los eventos disparados.
- [ ] `GET /v1/docs` Scalar muestra todos los endpoints documentados con tags `Auth`, `Admin / Users`, `Admin / Sessions`.

---

## Pre-requisitos para arrancar

- ✅ `00-foundation` cerrado (`@Public()` decorator, DomainErrorFilter, AppConfig, DbModule, Logger).
- ⏳ Redis disponible localmente para cache de sesiones (entra como dependencia de `docker-compose.local.yml` si no está).
- ⏳ Variables nuevas en `.env`: `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_COST`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_FULL_NAME`. Operador genera `JWT_SECRET` con `openssl rand -base64 48` antes de arrancar.

---

## Notas

- **Heredado de mapi v0.x:** el flujo bcrypt + JWT + login email-only ya está probado en producción 19 versiones. Lo reusamos con renames donde el naming no era consumible (ej. tabla `users` en mapi v0.x sí se llamaba así, no requiere rename).
- **Tabla `event_log` entra acá** en lugar de su propio bloque `95-event-log/` porque sin auth no hay `actor_user_id` real. Si en el futuro `event_log` crece (más eventos, más query API, retention policy), se mueve a su propio módulo en una versión nueva — pero arranca aquí compartiendo migration con users.
- **Rate limit en login:** lo más simple es usar `@nestjs/throttler` con 10 req/min por IP en el endpoint `/v1/auth/login`. Heredar como dep nueva en versión.
- **`auth.login.failed` payload:** guarda el email intentado y la IP, no el password (obvio). Útil para detectar brute force después.
- **Cuando entre `bookkeeper` rol** (M3 si crece equipo): se agrega como nueva variante del enum `role` con migration de tipo D-mapi-NNN. `RolesGuard` recibe `@Roles('admin', 'bookkeeper')` para endpoints que ambos pueden tocar.
- **Refresh tokens:** NO se implementan en v0.2.0. JWT corto expiry (7d) + sesión revocable cubre el caso. Si en el futuro un viewer se queja de "tener que loguearse cada semana", se evalúa refresh token vs JWT más largo.
