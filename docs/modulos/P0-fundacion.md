# P0 — Fundación

**Estado:** 🔬 En discusión (TDD final, esperando aprobación del operador para arrancar codeo)
**Inicio:** 2026-05-02
**Tipo:** Pre-requisito técnico
**Reemplaza GS:** N/A (es base técnica)

---

## Filosofía del módulo

Fundación = **base técnica que permite que cualquier módulo siguiente arranque sin pelearse con tooling, config, conexión a DB, debugging, documentación o deploy**.

Cuando llegue P1 (Intuit Core), M0 (auth), o cualquier módulo, NO debe pararse a configurar logger, DB connection, validación de env vars, OpenAPI docs, pre-commit hooks o pipeline de Coolify. Todo eso ya está listo.

**Hito de cierre:** los 3 apps (`mapi`, `web`, `kiro`) compilan local. `apps/mapi/` tiene endpoint `/v1/healthz` funcional con check de Postgres real, tanto en local como deployado en Coolify. `/v1/docs` muestra Scalar con sidebar agrupado por tags. Pre-commit hook bloquea commits malos en los 3 apps.

---

## Separación de entornos

3 entornos. Cada uno tiene su propia DB, su propia config, sus propias credenciales.

| Aspecto                 | local                                                   | test                               | production                                                 |
| ----------------------- | ------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| **Cómo arranca**        | `npm run start:dev` nativo en PC del operador           | `npm run test` con `.env.test`     | Container Docker en Coolify                                |
| **Postgres host**       | `localhost:5433` (container `docker-compose.local.yml`) | `localhost:5433` (mismo container) | servicio `postgres` interno del stack Coolify              |
| **DB name**             | `mapi_local`                                            | `mapi_test`                        | `mapi_prod`                                                |
| **Redis**               | `localhost:6379/1`                                      | `localhost:6379/2`                 | `redis://redis:6379/0` (servicio interno)                  |
| **Logger**              | pino-pretty stdout (legible)                            | pino silent                        | pino JSON stdout (Coolify lo captura)                      |
| **App Intuit**          | "BV CPAs Dev"                                           | mock                               | "BV CPAs, PLLC"                                            |
| **URL pública**         | `http://localhost:4000`                                 | N/A                                | subdominio asignado en panel Coolify                       |
| **Archivo de env vars** | `.env` (en `.gitignore`)                                | `.env.test` (en `.gitignore`)      | **NO existe archivo**. Coolify inyecta vars desde panel UI |
| **NODE_ENV**            | `local`                                                 | `test`                             | `production`                                               |

### Convenciones de nombres

- **Postgres DB:**
  - `mapi_local` (container local).
  - `mapi_test` (mismo container, DB separada para tests).
  - `mapi_prod` (container Coolify).
- **Redis db:**
  - `db=0` producción (container Coolify).
  - `db=1` local (heredado D-137 mapi v0.x).
  - `db=2` tests.

### Plantillas de env vars

- **`.env.example`** — committeado. Plantilla para clonar a `.env`. Contiene todas las vars que algún módulo va a leer en algún momento, con comentarios explicando qué hace cada una y valores ejemplo seguros.
- **`.env.test.example`** — committeado. Plantilla para tests. Solo vars necesarias para tests.
- **`.env`** — NO committeado. Se clona de `.env.example` y se llena con valores reales del operador.
- **`.env.test`** — NO committeado. Se clona de `.env.test.example`.
- **`.env.production`** — **NO existe** ni en repo ni en server. Coolify es la fuente de verdad de vars de producción.

---

## Alcance

### Sí entra

#### Repo raíz

1. `package.json` raíz mínimo (solo `husky` + `lint-staged` + scripts orquestadores que llaman a cada app vía `--prefix`).
2. `.husky/pre-commit` con 3 barreras (prettier check + eslint --max-warnings=0 + tsc --noEmit).
3. `.gitignore` con `node_modules/`, `dist/`, `.next/`, `coverage/`, `*.tsbuildinfo`, `.env`, `.env.test` (excepto `.env.example` y `.env.test.example`).
4. `README.md` corto con cómo arrancar el repo localmente.
5. `INDICE.md` actualizado a este módulo activo.
6. `.env.example` y `.env.test.example` en raíz (compartidos para los 3 apps, pero solo `apps/mapi/` los consume en P0).

#### `docker-compose.local.yml` (raíz)

7. Servicio `postgres`:
   - Imagen `pgvector/pgvector:pg16`.
   - DB inicial: `mapi_local`.
   - Puerto host: `5433`.
   - Volumen: `mapi-postgres-local-data`.
   - Healthcheck con `pg_isready`.
   - Container name: `mapi-postgres-local`.
8. Servicio `redis`:
   - Imagen `redis:7-alpine`.
   - Puerto host: `6379`.
   - Volumen: `mapi-redis-local-data`.
   - Healthcheck con `redis-cli ping`.
   - Container name: `mapi-redis-local`.
9. Comentado/preparado para crear `mapi_test` con `docker-compose.local.yml exec postgres psql -U mapi -c "CREATE DATABASE mapi_test"` o un init script.
10. **NO** incluye Loki, Grafana, Prometheus (no se usan en Fundación).
11. **NO** incluye el backend (corre nativo con `npm run start:dev`).

#### `apps/mapi/` (backend NestJS)

12. NestJS scaffold: `main.ts`, `app.module.ts` con todos los módulos core.
13. `package.json` con scripts heredados de mapi v0.x (`clean`, `build`, `start`, `start:dev`, `start:prod`, `lint`, `format`, `test`, `db:generate`, `db:migrate`, `db:studio`).
14. `tsconfig.json` con strict completo + `useUnknownInCatchVariables` + `paths: { @/*: ./src/* }`.
15. `tsconfig.build.json` (excluye tests).
16. `tsconfig.eslint.json` (incluye test/scripts para que ESLint los vea).
17. `tsconfig.scripts.json` (compila scripts CLI a `dist/scripts/`).
18. `eslint.config.mjs` flat config v9 con reglas estrictas + override en tests (D-063).
19. `.prettierrc` (`semi: false`, `singleQuote: true`, `endOfLine: lf`, override md/json).
20. `nest-cli.json` (configuración CLI Nest).
21. `Dockerfile` multi-stage 4 etapas (deps → build → prod-deps → runtime) con fix `NODE_ENV=development` en deps/build (heredado mapi v0.x).
22. `.env` clonado de `.env.example` con valores locales (`mapi_local`, redis db=1, app Intuit Dev).
23. `drizzle.config.ts` con `schema: ./src/db/schema/index.ts`, `out: ./drizzle/migrations`.
24. `scripts/migrate.ts` standalone con tsx que aplica migrations.
25. `src/db/schema/index.ts` con export vacío (placeholder).
26. **`src/main.ts`** con bootstrap completo:
    - `NestFactory.create(AppModule, { bufferLogs: true })`.
    - `app.useLogger(app.get(PinoLogger))`.
    - `app.setGlobalPrefix('v1', { exclude: ['metrics'] })`.
    - `app.enableShutdownHooks()`.
    - `app.enableCors({ origin: true, credentials: true })`.
    - `setupApiDocs()` con NestJS Swagger + nestjs-zod + Scalar UI.
    - Banner de startup que muestra: nombre, versión, NODE_ENV, port, URLs locales (sin URL pública en local).
    - Catch de bootstrap error → log + `process.exit(1)`.
27. **`src/app.module.ts`** importando: `AppConfigModule`, `LoggerModule`, `DbModule`, `MetricsModule`, `HealthModule`. Provee `DomainErrorFilter` global. Aplica `CorrelationIdMiddleware` en `*`.
28. **`src/core/config/`**:
    - `config.schema.ts` con Zod schema validador (ver sección Schema env).
    - `config.module.ts` `@Global()` que valida al boot, falla con mensaje claro listando todas las violaciones.
    - `config.service.ts` wrapper tipado.
29. **`src/core/logger/`**:
    - `logger.module.ts` `@Global()` con nestjs-pino.
    - Pino-pretty cuando `NODE_ENV=local` (singleLine, translateTime, mensaje con correlation_id).
    - JSON crudo a stdout cuando `NODE_ENV=production`.
    - Pino silent cuando `NODE_ENV=test`.
    - Mixin que inyecta `correlation_id` desde AsyncLocalStorage en cada log.
    - autoLogging filtra healthcheck interno (D-032).
    - **Pino-loki como transport NO entra todavía** (cuando se monte Loki en Coolify, se agrega el transport).
30. **`src/core/db/`**:
    - `db.module.ts` `@Global()` con providers `DB`, `DB_CLIENT`.
    - Drizzle + postgres-js, pool: `max: 10, idle_timeout: 20, connect_timeout: 10`.
    - `DbLifecycle` con `OnApplicationShutdown` que cierra el pool.
31. **`src/core/metrics/`**:
    - `metrics.module.ts` `@Global()`.
    - `metrics.service.ts` con Registry Prometheus + `collectDefaultMetrics({ register })`. Default labels `{ app: 'mapi', env: NODE_ENV }`. **Sin custom counters/gauges/histograms** (los módulos los agregan).
    - `metrics.controller.ts` con `GET /metrics` (sin prefijo `/v1`).
32. **`src/common/correlation/`**:
    - `correlation.context.ts` con `AsyncLocalStorage<CorrelationContext>` + `getCorrelationId()`.
    - `correlation-id.middleware.ts` que lee `x-correlation-id` header o genera UUID, lo expone en response header, lo guarda en AsyncLocalStorage.
33. **`src/common/decorators/`**:
    - `public.decorator.ts` con `@Public()` que setea `IS_PUBLIC_KEY`.
34. **`src/common/errors/`**:
    - `domain.error.ts` con `abstract class DomainError extends Error` + `code: string`.
    - `domain-error.filter.ts` con `@Catch(DomainError)` que mapea `code` a HTTP status según `STATUS_BY_CODE` (vacío en Fundación).
35. **`src/common/pipes/`**:
    - `zod-validation.pipe.ts` genérico que valida body/query/param contra un schema Zod.
36. **`src/common/version.ts`** que lee `package.json` y exporta `APP_VERSION`, `APP_NAME`.
37. **`src/modules/health/`**:
    - `health.module.ts`.
    - `health.controller.ts` con `GET /v1/healthz`, marcado `@Public()` y `@ApiTags('Health')`.
    - `health.service.ts` con check paralelo a Postgres (`SELECT 1`). Devuelve `{ status, version, env, uptime_s, timestamp, components: { db } }`. **Sin Redis check** (Redis no entra en Fundación, entra cuando un módulo lo necesite).
38. **OpenAPI docs con Scalar:**
    - `setupApiDocs()` en main.ts genera spec con `DocumentBuilder().setTitle('mapi API').setVersion(APP_VERSION).addBearerAuth(...)`.
    - Endpoint `GET /v1/docs-json` devuelve spec OpenAPI cruda.
    - Endpoint `GET /v1/docs` sirve UI de Scalar (`@scalar/nestjs-api-reference`).
    - HealthController marcado con `@ApiTags('Health')` para que aparezca agrupado en sidebar.

#### `apps/web/` (frontend Next.js scaffold)

39. Next.js 15 App Router scaffold mínimo.
40. `package.json` con deps base (`next`, `react`, `react-dom`, `typescript`). **Sin Tailwind, sin shadcn, sin librerías de UI**.
41. `tsconfig.json` con `paths: { @/*: ./src/* }`.
42. `eslint.config.mjs`.
43. `.prettierrc`.
44. `next.config.mjs`.
45. `Dockerfile` multi-stage para Coolify (preparado, no se deploya en P0).
46. `src/app/layout.tsx` mínimo.
47. `src/app/page.tsx` con "Hello bvcpas".
48. `src/app/globals.css` con CSS plano.

#### `apps/kiro/` (Chrome extension Manifest v3)

49. Vite scaffold para Chrome extension.
50. `package.json` con deps (`vite`, `@types/chrome`, `typescript`).
51. `tsconfig.json` con `paths: { @/*: ./src/* }`.
52. `eslint.config.mjs`.
53. `.prettierrc`.
54. `vite.config.ts` configurado para build de extension.
55. `manifest.json` Manifest v3 mínimo.
56. `src/popup/popup.html` y `src/popup/popup.tsx` con "Hello".
57. `src/background.ts` placeholder vacío.
58. **Sin WebSocket client, sin lógica de QBO, sin content scripts.**

#### `docker-compose.yaml` (prod para Coolify)

59. Servicio `postgres`:
    - Imagen `pgvector/pgvector:pg16`.
    - Vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB=mapi_prod` (Coolify llena las críticas).
    - Volumen: `mapi-postgres-prod-data`.
    - Healthcheck con `pg_isready`.
60. Servicio `redis`:
    - Imagen `redis:7-alpine` con `appendonly yes`.
    - Volumen: `mapi-redis-prod-data`.
    - Healthcheck con `redis-cli ping`.
61. Servicio `mapi`:
    - `build: { context: ./apps/mapi, dockerfile: Dockerfile }`.
    - `NODE_ENV=production`.
    - `PORT=4100`.
    - `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`.
    - `REDIS_URL=redis://redis:6379` (db=0 default en producción).
    - `depends_on: postgres + redis (service_healthy)`.
    - `healthcheck` con node http GET `/v1/healthz`.
    - Labels Traefik para que Coolify lo enrute al subdominio que tú asignes en el panel.
    - `expose: 4100` (no `ports:`, Traefik enruta por hostname).
62. **NO** incluye Loki, Prometheus, Grafana, backup container, Dockerfile.backup, ni cloudflared. Esos entran cuando se necesiten.

#### Cross-app

63. Scripts raíz que orquestan `typecheck`, `lint`, `format`, `format:check` en los 3 apps.
64. Pre-commit hook que filtra archivos staged por path (apps/mapi/**, apps/web/**, apps/kiro/\*\*) y los valida con la config correspondiente.

---

### NO entra

#### Auth y seguridad

1. `AuthModule`, login, JWT, bcrypt, setup admin endpoints.
2. `JwtAuthGuard`, `RolesGuard` como APP_GUARD globales.
3. `EncryptionModule` AES-256-GCM. Entra con P1.
4. Tabla `users`. Entra con AuthModule.
5. Schema Zod de `JWT_SECRET`, `JWT_EXPIRES_IN`, `ENCRYPTION_KEY` validados.
6. TOTP, recovery, password reset, multi-user, roles bookkeeper/viewer.

#### Persistencia avanzada

7. `RedisModule`, `QueueModule` (BullMQ).
8. Schema Zod de `REDIS_URL` validado.
9. Tablas de negocio.
10. `ScheduleModule` (cron).

#### Intuit y QBO

11. `IntuitOauthModule`, OAuth flow, callback, refresh tokens, IntuitApiService.
12. Schema Zod de `INTUIT_*` validados.
13. Migración de los 77 clientes desde mapi v0.x.

#### WebSocket y bridge

14. `WsAdapter` en main.ts.
15. `IntuitBridgeModule`.
16. Schema Zod de `BRIDGE_SHARED_SECRET` validado.
17. WebSocket client en plugin.

#### Observabilidad avanzada

18. pino-loki transport activo. Logger ya está listo, agregar transport es 5 líneas cuando se monte Loki.
19. Custom metrics específicas (`auth_login_total`, `intuit_api_calls_total`, etc.).
20. Loki, Prometheus, Grafana corriendo (ni en `docker-compose.local.yml` ni en `docker-compose.yaml` prod).
21. Body parser limit 1GB.

#### Frontend

22. Tailwind CSS, shadcn/ui, TanStack Table, react-hook-form, SWR.
23. Páginas reales más allá del "Hello".
24. Auth en frontend.
25. Deploy de `apps/web/` a Coolify (P0 deploya solo `mapi`).

#### Plugin

26. Manifest permissions específicos.
27. Content scripts.
28. UI compleja en popup/sidepanel.
29. Deploy de `kiro` a Coolify (no aplica, plugin se instala manual).

#### Deployment

30. Cloudflare tunnel config para subdominios.
31. Backups automáticos (Dockerfile.backup, rclone, cron).
32. CI / GitHub Actions.

#### Otros

33. Carpeta `shared/` o `shared-types/`. Entra cuando el primer tipo se necesite cross-app.
34. `EventLogModule` (audit log).

---

## Schema env validado en Fundación

`apps/mapi/src/core/config/config.schema.ts` valida SOLO lo que el código de Fundación lee:

```typescript
NODE_ENV: z.enum(['local', 'test', 'production']).default('local')
PORT: z.coerce.number().int().positive().default(4000)
LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
PUBLIC_URL: z.string().url().optional()
LOKI_URL: z.string().url().optional()
DATABASE_URL: z.string().url()
```

**El `.env` puede tener TODAS las demás vars** (JWT*SECRET, INTUIT*\*, BRIDGE_SHARED_SECRET, etc., heredadas tal cual de mapi v0.x). El schema NO las valida en Fundación. Cuando entre el módulo correspondiente, agrega su línea al schema.

**Razón:** principio de "no se valida algo que no se usa".

---

## Schema (tablas + columnas)

**Sin tablas en Fundación.** `apps/mapi/src/db/schema/index.ts` exporta `{}` vacío.

`apps/mapi/drizzle.config.ts` apunta a ese archivo. `drizzle-kit generate` no produce migrations. Cuando entre el primer módulo con tabla (probablemente Auth o P1), genera su primera migration.

---

## Endpoints

### `GET /v1/healthz`

- **Body:** N/A.
- **Response:**
  ```typescript
  {
    status: 'up' | 'down',
    version: string,
    env: 'local' | 'test' | 'production',
    uptime_s: number,
    timestamp: string,
    components: {
      db: { status: 'up' | 'down', latency_ms?: number, error?: string }
    }
  }
  ```
- **Side effects:** ninguno.
- **Auth:** `@Public()`.
- **Tag OpenAPI:** `Health`.

### `GET /metrics`

- **Body:** N/A.
- **Response:** texto plano formato Prometheus exposition con métricas default de Node (heap, GC, event loop, CPU). Default labels `{ app: 'mapi', env: NODE_ENV }`.
- **Side effects:** ninguno.
- **Auth:** público (sin prefijo `/v1`).

### `GET /v1/docs`

- **Body:** N/A.
- **Response:** UI Scalar con sidebar agrupado por tags.
- **Side effects:** ninguno.
- **Auth:** público.

### `GET /v1/docs-json`

- **Body:** N/A.
- **Response:** JSON con la spec OpenAPI.
- **Side effects:** ninguno.
- **Auth:** público.

---

## Eventos system_events

Ninguno en Fundación. La tabla `system_events` no existe todavía.

---

## Errores de dominio

Ninguno específico. La infra está lista (`DomainError` clase + `DomainErrorFilter` global) pero `STATUS_BY_CODE` vacío hasta que un módulo agregue errores propios.

---

## Reglas de documentación OpenAPI (obligatorias en TODO módulo siguiente)

Estas reglas se establecen en Fundación y aplican desde P1 en adelante.

### Regla DOC-1: agrupación obligatoria por módulo

Cada `Controller` debe declarar `@ApiTags()` con el nombre del módulo. El tag agrupa los endpoints en el sidebar de Scalar.

**Convención de tags:**

- Pre-requisitos: `Health`, `Metrics`.
- Módulos de negocio: nombre legible. Ejemplos: `Auth`, `Clients`, `QBO Connections`, `Uncats Pipeline`, `Customer Support`, `Stmts/Recon`, `Receipts`, `1099 Tracker`, `W9 Tracker`.
- Sub-grupos del mismo módulo cuando hay 5+ endpoints: `Clients - CRUD`, `Clients - QBO Connection`.

```typescript
@ApiTags('Auth')
@Controller('auth')
export class AuthController { ... }
```

### Regla DOC-2: descripción del endpoint obligatoria

Cada handler debe declarar `@ApiOperation()` con `summary` (5-10 palabras) y `description` (qué hace, side effects, errores típicos).

```typescript
@ApiOperation({
  summary: 'Login con email y password',
  description: `
    Valida credenciales y devuelve JWT con claims { sub, email, role }.
    JWT expira en JWT_EXPIRES_IN (default 7d).
    Side effects: actualiza users.last_login_at, registra evento auth.login.success/failed.
    Errores típicos:
      - 401 INVALID_CREDENTIALS: email no existe o password incorrecto.
      - 401 USER_DISABLED: usuario existe pero enabled=false.
  `,
})
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

### Regla DOC-3: cada parámetro de DTO documentado

Todo campo de un DTO debe tener `@ApiProperty()` con `description`, `example`, `required` explícito si no es obvio, validaciones cuando apliquen.

```typescript
class LoginDto {
  @ApiProperty({
    description: 'Email del admin registrado en la tabla users',
    example: 'admin@bvcpas.com',
    required: true,
  })
  email: string

  @ApiProperty({
    description: 'Password en plano. Se compara con bcrypt contra users.password_hash',
    example: 'MyP@ssw0rd123',
    required: true,
    minLength: 8,
  })
  password: string
}
```

### Regla DOC-4: respuestas obligatorias para 200 + errores conocidos

```typescript
@ApiResponse({ status: 200, description: 'Login exitoso, devuelve JWT', type: LoginResponseDto })
@ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS o USER_DISABLED' })
```

### Regla DOC-5: query params y path params documentados

Para `@Param()` y `@Query()`, declarar `@ApiParam()` o `@ApiQuery()` con descripción + ejemplo.

### Regla DOC-6: bearer auth declarado en endpoints protegidos

Endpoints que requieren JWT deben declarar `@ApiBearerAuth('bearer')`. Públicos NO.

### Regla DOC-7: ejemplos en request body

Pre-llenar el form de "Try it out" con valores realistas usando el `example` del DTO.

### Regla DOC-8: validación cruzada con Zod

Como usamos `nestjs-zod`, los DTOs son schemas Zod. `cleanupOpenApiDoc` convierte a OpenAPI. Usar `.describe()` en cada campo Zod para que se renderice como descripción en Scalar.

### Cómo se valida que un endpoint cumple

Smoke test al cerrar cada módulo posterior:

- [ ] Abrir `/v1/docs` en browser.
- [ ] Verificar que el endpoint nuevo aparece en el sidebar bajo el tag correcto.
- [ ] Click en el endpoint → ver descripción larga.
- [ ] Verificar que cada parámetro tiene descripción + ejemplo.
- [ ] Click "Try it out" → form pre-llenado.
- [ ] Ejecutar request → respuesta visible.

Si alguno falla, el endpoint NO cumple DOC-1 a DOC-8 y se rechaza el commit del módulo.

---

## Tests

### Comportamientos críticos a proteger

| Test                                | Debe fallar si...                                                 |
| ----------------------------------- | ----------------------------------------------------------------- |
| `config.schema.spec.ts`             | El schema acepta `NODE_ENV` inválido.                             |
| `config.schema.spec.ts`             | El schema acepta `DATABASE_URL` no-URL.                           |
| `config.schema.spec.ts`             | El schema permite arrancar sin `DATABASE_URL`.                    |
| `correlation-id.middleware.spec.ts` | El middleware no propaga el ID al AsyncLocalStorage.              |
| `correlation-id.middleware.spec.ts` | El middleware no respeta header existente y siempre genera nuevo. |
| `domain-error.filter.spec.ts`       | Un error con código conocido devuelve HTTP status incorrecto.     |
| `domain-error.filter.spec.ts`       | Un error con código desconocido NO devuelve 400 default.          |
| `health.controller.spec.ts`         | `/v1/healthz` requiere JWT (debe ser público).                    |
| `health.service.spec.ts`            | DB caída no se reporta como `status: 'down'` con error message.   |
| `health.service.spec.ts`            | DB OK no reporta `latency_ms`.                                    |
| `health.service.spec.ts`            | Response no incluye `env` con valor de NODE_ENV.                  |

### Fixtures necesarios

Ninguno.

### Smoke test del módulo

Operador ejecuta manual antes de cerrar:

#### Local

- [ ] `npm install` en raíz no falla.
- [ ] `npm install` en `apps/mapi/`, `apps/web/`, `apps/kiro/` no falla.
- [ ] `docker-compose -f docker-compose.local.yml up -d` levanta `mapi-postgres-local` y `mapi-redis-local`.
- [ ] `psql -h localhost -p 5433 -U mapi -d mapi_local` conecta.
- [ ] `cd apps/mapi && npm run db:generate` no produce migrations (schema vacío).
- [ ] `cd apps/mapi && npm run db:migrate` aplica (vacías) sin error.
- [ ] `cd apps/mapi && npm run start:dev` levanta sin errores en puerto 4000.
- [ ] Banner imprime: `NODE_ENV=local`, port 4000, URLs locales (sin tunnel).
- [ ] `curl http://localhost:4000/v1/healthz` devuelve `{ status: 'up', version, env: 'local', components: { db: { status: 'up', latency_ms: <num> } } }`.
- [ ] `curl http://localhost:4000/metrics` devuelve formato Prometheus con `app="mapi", env="local"`.
- [ ] Browser en `http://localhost:4000/v1/docs` muestra Scalar con sidebar mostrando tag "Health".
- [ ] Click en `GET /v1/healthz` → ve descripción + try it out funcional.
- [ ] `curl http://localhost:4000/v1/docs-json` devuelve JSON OpenAPI.
- [ ] `cd apps/web && npm run dev` levanta en puerto 3000 mostrando "Hello bvcpas".
- [ ] `cd apps/kiro && npm run build` genera `dist/`. Chrome carga sin errores.
- [ ] Desde raíz: `npm run typecheck`, `npm run lint`, `npm run format:check` corren los 3 apps OK.
- [ ] Pre-commit bloquea archivo con `any` explícito en mapi.
- [ ] Pre-commit bloquea archivo mal formateado.
- [ ] Pre-commit bloquea archivo con type error.

#### Production-like local (verifica que docker-compose.yaml prod funciona)

- [ ] `cp .env.example .env.production-test` y llenar valores tipo prod.
- [ ] `docker compose -f docker-compose.yaml --env-file .env.production-test build` compila los 3 servicios.
- [ ] `docker compose -f docker-compose.yaml --env-file .env.production-test up -d` levanta postgres + redis + mapi.
- [ ] `docker compose ps` muestra los 3 healthy.
- [ ] `docker exec <mapi-container> curl http://localhost:4100/v1/healthz` responde con `env: 'production'`, db up.
- [ ] `docker compose down -v` limpia.
- [ ] Borrar `.env.production-test`.

#### Coolify deploy

- [ ] Crear proyecto en Coolify apuntando al repo bvcpas-project, branch main.
- [ ] Configurar `docker-compose.yaml` como source.
- [ ] Configurar env vars en panel Coolify (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB=mapi_prod`, `JWT_SECRET`, `ENCRYPTION_KEY`, `INTUIT_*` con la app "BV CPAs, PLLC").
- [ ] Asignar subdominio en panel Coolify.
- [ ] Disparar deploy.
- [ ] Verificar logs Coolify: stack levanta sin errores, `mapi` healthy.
- [ ] `curl https://<subdominio>/v1/healthz` devuelve up con DB up y `env: 'production'`.
- [ ] Browser `https://<subdominio>/v1/docs` muestra Scalar.
- [ ] Auto-deploy en push a `main` funciona.

---

## Decisiones tomadas en este módulo

- **D-001:** No `nest build`, usar `tsc + tsc-alias`. Heredado D-071 mapi v0.x.
- **D-002:** `apps/mapi/.env` y `.env.example` se copian de mapi v0.x con valores adaptados a `mapi_local` y app Intuit "BV CPAs Dev".
- **D-003:** Schema Zod de Fundación valida SOLO lo que se usa en Fundación.
- **D-004:** DbModule activo desde Fundación. `DATABASE_URL` requerido en config schema.
- **D-005:** OpenAPI con **Scalar** (`@scalar/nestjs-api-reference`). Layout 3 paneles, agrupación por tags.
- **D-005b:** Reglas de documentación obligatorias DOC-1 a DOC-8 desde P1 en adelante.
- **D-006:** `apps/web/` entra en Fundación con scaffold mínimo Next.js 15 sin Tailwind/shadcn.
- **D-007:** `apps/kiro/` entra con scaffold mínimo Vite + Manifest v3 sin WebSocket.
- **D-008:** `core/encryption/` NO entra en Fundación. Entra con P1.
- **D-009:** `core/redis/` y `core/queue/` (BullMQ) NO entran. Entran cuando un módulo los necesite.
- **D-010:** `MetricsModule` SÍ entra. Solo métricas default de Node.
- **D-011:** pino-loki transport NO se activa. Logger solo escribe a stdout.
- **D-012:** `DomainErrorFilter` con `STATUS_BY_CODE` vacío.
- **D-013:** `WsAdapter` NO se monta en `main.ts` de Fundación.
- **D-014:** Carpeta de tipos compartidos NO entra. Entra cuando el primer tipo se necesite cross-app.
- **D-015:** `apps/mapi/Dockerfile` con CMD `node dist/main.js` (sin migrate). Migrate manual con `npm run db:migrate`.
- **D-016:** Pre-commit hook en raíz, no por app. lint-staged config en `package.json` raíz filtra por path.
- **D-017:** **NODE_ENV con 3 valores: `local | test | production`.** No usar `development`. Razón: ambigüedad en JS-land (Next.js, Vite, NestJS interpretan "development" distinto).
- **D-018:** **Naming de DBs Postgres: `mapi_local`, `mapi_test`, `mapi_prod`.** Una por entorno. Sufijo explícito en los 3 (no se usa "default sin sufijo").
- **D-019:** **`.env.production` NO existe** ni en repo ni en server. Coolify es la fuente única de verdad para vars de producción (panel UI).
- **D-020:** `docker-compose.yaml` (prod) incluye `postgres + redis + mapi` en un solo stack (Opción B). Coolify levanta el stack completo. Backups del compose stack como unidad.
- **D-021:** Subdominio de producción se decide al momento de crear el resource en Coolify. **NO** se precommetea ningún nombre en el TDD.
- **D-022:** **NO se usa npm workspaces.** Cada app independiente con su propio `node_modules`. Tipos compartidos via tsconfig paths cuando se necesiten.
- **D-023:** **Naming de packages en cada app:** `mapi`, `web`, `kiro` (planos, sin scope). Razón: sin workspaces, los nombres son solo etiquetas.
- **D-024:** Redis db por entorno: `db=0` prod, `db=1` local, `db=2` test. Heredado D-137 mapi v0.x.

---

## Reuso de mapi v0.x

| Componente mapi v0.x                              | Tratamiento       | Nota                                                                                                                          |
| ------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `package.json` scripts                            | COPIAR            | Adaptar paths.                                                                                                                |
| `.prettierrc`                                     | COPIAR            | Idéntico.                                                                                                                     |
| `eslint.config.mjs`                               | COPIAR            | Quitar override de `src/modules/20-intuit-oauth/api-client/types/**`.                                                         |
| `tsconfig.*.json` (4 archivos)                    | COPIAR            | Idénticos.                                                                                                                    |
| `.husky/pre-commit`                               | REFACTOR LEVE     | Quitar `validate-roadmap.ts`. Adaptar para multi-app.                                                                         |
| `Dockerfile`                                      | COPIAR            | Idéntico estructura 4 stages.                                                                                                 |
| `drizzle.config.ts`                               | COPIAR            | Idéntico.                                                                                                                     |
| `scripts/migrate.ts`                              | COPIAR            | Idéntico.                                                                                                                     |
| `src/main.ts`                                     | REFACTOR LEVE     | Quitar `WsAdapter`, body parser 1GB, Swagger UI. Cambiar título a `'mapi API'` (o nombre que decidas). Banner muestra `env`.  |
| `src/app.module.ts`                               | REFACTOR FUERTE   | Solo: AppConfig, Logger, Db, Metrics, Health.                                                                                 |
| `src/core/config/config.schema.ts`                | REFACTOR FUERTE   | Solo NODE_ENV (con `local                                                                                                     | test | production`), PORT, LOG_LEVEL, PUBLIC_URL?, LOKI_URL?, DATABASE_URL. |
| `src/core/config/config.module.ts`                | COPIAR            | Idéntico.                                                                                                                     |
| `src/core/config/config.service.ts`               | COPIAR            | Tipado contra schema nuevo.                                                                                                   |
| `src/core/logger/logger.module.ts`                | REFACTOR LEVE     | Adaptar pino-pretty/JSON/silent según `NODE_ENV`. Quitar pino-loki transport.                                                 |
| `src/core/db/db.module.ts`                        | COPIAR            | Idéntico.                                                                                                                     |
| `src/core/encryption/`                            | TIRAR (Fundación) | Entra con P1.                                                                                                                 |
| `src/core/redis/`                                 | TIRAR             | Entra cuando se necesite.                                                                                                     |
| `src/core/queue/`                                 | TIRAR             | Entra cuando se necesite.                                                                                                     |
| `src/core/metrics/metrics.service.ts`             | REFACTOR FUERTE   | Quitar TODAS las custom metrics. Default labels con `env`.                                                                    |
| `src/core/metrics/metrics.controller.ts`          | COPIAR            | Idéntico.                                                                                                                     |
| `src/core/metrics/metrics.module.ts`              | COPIAR            | Idéntico.                                                                                                                     |
| `src/common/correlation/`                         | COPIAR            | Idéntico.                                                                                                                     |
| `src/common/decorators/public.decorator.ts`       | COPIAR            | Idéntico.                                                                                                                     |
| `src/common/decorators/current-user.decorator.ts` | TIRAR (Fundación) | Entra con AuthModule.                                                                                                         |
| `src/common/decorators/roles.decorator.ts`        | TIRAR (Fundación) | Entra con AuthModule.                                                                                                         |
| `src/common/errors/domain.error.ts`               | COPIAR            | Idéntico.                                                                                                                     |
| `src/common/errors/domain-error.filter.ts`        | REFACTOR LEVE     | Vaciar `STATUS_BY_CODE`.                                                                                                      |
| `src/common/guards/`                              | TIRAR (Fundación) | Entran con módulos.                                                                                                           |
| `src/common/pipes/zod-validation.pipe.ts`         | COPIAR            | Idéntico.                                                                                                                     |
| `src/common/version.ts`                           | COPIAR            | Idéntico.                                                                                                                     |
| `src/modules/health/`                             | REFACTOR LEVE     | Quitar Redis check. Solo DB. Agregar `env` al response.                                                                       |
| `Dockerfile.backup`                               | TIRAR (Fundación) | Entra con backup automation.                                                                                                  |
| `docker-compose.local.yml`                        | REFACTOR FUERTE   | Solo Postgres + Redis. Sin Loki, Grafana, Prometheus. DB `mapi_local`, Redis db=1.                                            |
| `docker-compose.yaml` (prod)                      | REFACTOR FUERTE   | Solo `postgres + redis + mapi`. Sin Loki, Prometheus, Grafana, backup, cloudflared.                                           |
| `.env.example`                                    | REFACTOR LEVE     | Vars actualizadas (`mapi_local`, NODE_ENV=local). Mantener todas las vars heredadas comentadas si su módulo no entró todavía. |
| `.env.test.example`                               | COPIAR            | Adaptar a `mapi_test` y db=2.                                                                                                 |
| `docs/`, `roadmap/`, `agent/`, `CHANGELOG.md`     | TIRAR             | bvcpas tiene su propio sistema.                                                                                               |

---

## TODOs (sub-etapas / commits)

Cada sub-etapa = un commit con título `P0.X — <título>`.

- [ ] **P0.1 — Repo raíz**
  - `package.json` mínimo (sin workspaces, husky + lint-staged + scripts orquestadores).
  - `.husky/pre-commit` con 3 barreras.
  - `.gitignore`.
  - `.env.example` y `.env.test.example` en raíz.
  - `README.md` corto.
  - Actualizar `INDICE.md`: P0 cambia a 🚧.
  - **Verificación:** `npm install` raíz instala husky.

- [ ] **P0.2 — `docker-compose.local.yml`**
  - Servicios postgres + redis con DB `mapi_local`, Redis db=1.
  - Volúmenes con sufijo `-local-data`.
  - Container names `mapi-postgres-local`, `mapi-redis-local`.
  - **Verificación:** `docker compose -f docker-compose.local.yml up -d` levanta, ambos healthy. `psql` conecta a `mapi_local`. Crear `mapi_test` manual.

- [ ] **P0.3 — `apps/mapi/` scaffold**
  - NestJS scaffold.
  - 4 tsconfigs.
  - `eslint.config.mjs`, `.prettierrc`.
  - `Dockerfile` 4 stages.
  - `package.json` con scripts y deps.
  - Copiar `.env.example` raíz a `apps/mapi/.env` con valores locales.
  - `drizzle.config.ts` + `scripts/migrate.ts` + `src/db/schema/index.ts` vacío.
  - `nest-cli.json`.
  - **Verificación:** `cd apps/mapi && npm install` OK.

- [ ] **P0.4 — `apps/mapi/` core: config + logger + common**
  - `src/core/config/` (schema con `local|test|production`, module, service).
  - `src/core/logger/` (module con pino-pretty/JSON/silent según env).
  - `src/common/correlation/` (middleware + context).
  - `src/common/errors/` (DomainError + filter vacío).
  - `src/common/decorators/public.decorator.ts`.
  - `src/common/pipes/zod-validation.pipe.ts`.
  - `src/common/version.ts`.
  - `src/main.ts` con bootstrap inicial (sin OpenAPI todavía).
  - `src/app.module.ts` con AppConfig + Logger + middleware.
  - **Verificación:** `npm run start:dev` levanta. Logs muestran pino-pretty con correlation_id.

- [ ] **P0.5 — `apps/mapi/` DbModule + HealthModule**
  - `src/core/db/db.module.ts`.
  - `src/modules/health/` (module, controller, service con DB check + `env` en response).
  - `src/app.module.ts` actualizado.
  - **Verificación:** Postgres corriendo. `npm run start:dev` levanta. `curl /v1/healthz` devuelve `{ status: up, env: local, components: { db: { status: up } } }`.

- [ ] **P0.6 — `apps/mapi/` MetricsModule + Scalar OpenAPI**
  - `src/core/metrics/` con default labels `{ app: 'mapi', env: NODE_ENV }`.
  - `setupApiDocs()` con Scalar UI.
  - HealthController con `@ApiTags('Health')` + DOC-2/DOC-4.
  - **Verificación:** `curl /metrics` formato Prometheus. Browser `/v1/docs` muestra sidebar con "Health".

- [ ] **P0.7 — `apps/web/` scaffold**
  - Next.js 15.
  - `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `next.config.mjs`, `Dockerfile`.
  - `src/app/layout.tsx`, `src/app/page.tsx` con "Hello bvcpas".
  - **Verificación:** `npm run dev` muestra "Hello".

- [ ] **P0.8 — `apps/kiro/` scaffold**
  - Vite + Manifest v3.
  - `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `vite.config.ts`.
  - `manifest.json`, popup, background placeholder.
  - **Verificación:** `npm run build` genera `dist/`. Chrome carga sin errores.

- [ ] **P0.9 — Validación cross-app + smoke test pre-commit**
  - Scripts raíz (`typecheck`, `lint`, `format`, `format:check`) orquestadores con `--prefix`.
  - lint-staged config raíz que filtra por path.
  - Probar pre-commit con archivos malos en cada app.
  - **Verificación:** smoke test local completo (sección "Tests").

- [ ] **P0.10 — `docker-compose.yaml` prod + smoke test production-like local**
  - Servicios `postgres + redis + mapi`.
  - Vars con `${...}` que Coolify llena.
  - Healthchecks en los 3.
  - Labels Traefik en `mapi`.
  - **Verificación:** `docker compose build && up` local con `.env` tipo prod. `/v1/healthz` responde `env: production`.

- [ ] **P0.11 — Deploy a Coolify**
  - Crear proyecto en Coolify apuntando al repo.
  - Configurar env vars en panel.
  - Asignar subdominio.
  - Auto-deploy en push.
  - **Verificación:** smoke test Coolify (sección "Tests" → Coolify deploy).
  - Actualizar `INDICE.md`: P0 a ✅.
  - Actualizar `_CONTEXTO_TEMPORAL.md` mencionando que P0 cerró.

---

## Hitos de cierre del módulo

- [ ] Todas las sub-etapas commit-eadas en `main`.
- [ ] Smoke test local completo pasa.
- [ ] Smoke test production-like local pasa.
- [ ] Smoke test Coolify pasa (deploy real funcional).
- [ ] Pre-commit hook bloquea commits con prettier/eslint/tsc fail.
- [ ] Operador uso el repo y el deploy de Coolify al menos 3 días distintos.
- [ ] `INDICE.md` actualizado con P0 = ✅ y link al TDD.
- [ ] Cero "ya que estamos" agregados.

---

## Notas

### Ubicación del TDD

`d:\proyectos\bvcpas-project\modulos\P0-fundacion.md`. Cuando P0 cierre, queda como histórico.

### Cambios respecto a iteraciones previas del TDD

- Sub-etapas pasaron de 8 a 11 (agregadas P0.10 docker-compose prod y P0.11 deploy Coolify).
- Separación de entornos formalizada (sección dedicada).
- D-017 a D-024 agregadas con decisiones finales del operador.
- NODE_ENV usa `local` (no `development`).
- DBs explícitas: `mapi_local`, `mapi_test`, `mapi_prod`.
- `docker-compose.yaml` prod incluye Postgres + Redis (Opción B confirmada).
- Subdominio Coolify NO se precommetea, se decide al deployar.
