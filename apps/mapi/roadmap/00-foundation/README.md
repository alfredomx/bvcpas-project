# 00-foundation — Bootstrap e infra cross-cutting de mapi

**App:** mapi
**Status:** ✅ Completo
**Versiones que lo construyen:** [v0.1.0](v0.1.0.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este módulo

`00-foundation` es la base técnica de `mapi` sobre la que se construye cualquier módulo de dominio. No resuelve un problema del operador directamente — resuelve el problema de tener un backend en producción con observabilidad, validación de configuración, manejo de errores homogéneo y deploy reproducible. Sin esto, los módulos siguientes (Intuit, staging, classification) no tienen dónde correr.

Antes de que existiera (mapi v0.x), parte de esta infra ya estaba probada en producción durante 19 versiones. `00-foundation` toma lo que aprendió mapi v0.x y lo consolida en un único bootstrap limpio dentro del nuevo repo `bvcpas-project`.

Lo que cambia con `00-foundation` listo:

- Hay un `mapi` corriendo en `https://mapi.kodapp.com.mx` con auto-deploy on push a `main`.
- Cualquier módulo nuevo puede inyectar config tipada, logger pino con correlation_id, drizzle/postgres, prom-client, scalar para docs.
- El pre-commit hook bloquea código que no compila, no lintea o no formatea.

---

## Alcance

### Sí entra

- Scaffold NestJS 11 + 4 tsconfigs (json, build, eslint, scripts) + eslint flat v9 con reglas estrictas + prettier + Dockerfile multi-stage 4 etapas.
- Core infra:
  - `core/config/`: schema Zod + `AppConfigModule` global con validate fail-fast + `AppConfigService` tipado.
  - `core/logger/`: nestjs-pino global con pino-pretty en local, JSON en prod, silent en test. Mixin de `correlation_id` desde AsyncLocalStorage.
  - `core/db/`: `@Global()` con tokens `DB` (drizzle) y `DB_CLIENT` (postgres-js raw). Shutdown limpio del pool.
  - `core/metrics/`: `Registry` prom-client con default labels, `collectDefaultMetrics`, `GET /metrics` sin prefijo `/v1`.
- Common transversal:
  - `common/correlation/`: AsyncLocalStorage + middleware UUID.
  - `common/errors/`: `DomainError` abstract + filter global.
  - `common/decorators/public.decorator.ts`: `@Public()` para futuro AuthGuard.
  - `common/pipes/zod-validation.pipe.ts`: validación genérica.
  - `common/version.ts`: APP_NAME + APP_VERSION leídos de package.json.
- HealthModule con `GET /v1/healthz` documentado en Scalar (`HealthResponseDto` con Zod).
- OpenAPI con Scalar 3-pane: `GET /v1/docs` (UI) + `GET /v1/docs-json` (spec).
- `docker-compose.yaml` raíz para Coolify (postgres + redis + mapi).
- Deploy en Coolify a `https://mapi.kodapp.com.mx` vía Cloudflare Tunnel + wildcard `*.kodapp.com.mx`. Auto-deploy on push a `main`.

### NO entra

- AuthModule (JWT, users CRUD) — entra cuando un módulo de dominio lo necesite (probablemente con primer dashboard o admin).
- Migraciones drizzle reales (carpeta `apps/mapi/drizzle/migrations/` con `.gitkeep`).
- Módulos de dominio: clients, intuit, staging, etc. — viven en sus propias carpetas (`10-...`, `11-...`, `20-...`).
- Loki/Grafana, backup container, cloudflared dentro del compose Coolify (heredados como diferidos del proyecto).
- Redis check en HealthService (entra cuando BullMQ se use).
- Worker BullMQ (en mismo proceso que API hasta que un job pesado afecte latencia HTTP).

---

## Naming visible al operador

Ninguno aplicable. `00-foundation` no expone UI ni rutas operativas — los únicos endpoints visibles son:

- `GET /v1/healthz` — JSON técnico, no requiere naming aprobado.
- `GET /v1/docs` — UI Scalar autogenerada.
- `GET /metrics` — formato Prometheus.

---

## Diseño técnico

### Tablas DB

Ninguna. `00-foundation` no introduce schema. La carpeta `apps/mapi/drizzle/migrations/` arranca vacía con `.gitkeep`.

### Endpoints API

| Method | Path          | Auth    | Request | Response                          | Errores                |
| ------ | ------------- | ------- | ------- | --------------------------------- | ---------------------- |
| GET    | /v1/healthz   | Pública | —       | `HealthResponseDto`               | 503 si componente down |
| GET    | /metrics      | Pública | —       | text/plain (Prometheus)           | —                      |
| GET    | /v1/docs      | Pública | —       | text/html (Scalar UI)             | —                      |
| GET    | /v1/docs-json | Pública | —       | application/json (OpenAPI 3 spec) | —                      |

### Eventos event_log

Ninguno. `event_log` no entra hasta que llegue auth o intuit (donde hay acciones auditables).

### Errores de dominio

Ninguno. `DomainErrorFilter` está montado pero `STATUS_BY_CODE` arranca vacío. Cada módulo posterior agrega los suyos.

### Configuración / env vars

Validadas por Zod en `core/config/config.schema.ts`:

| Variable     | Tipo          | Required | Default   | Notas                                      |
| ------------ | ------------- | -------- | --------- | ------------------------------------------ |
| NODE_ENV     | enum          | No       | `local`   | `local \| test \| production`              |
| PORT         | number coerce | No       | `4000`    |                                            |
| LOG_LEVEL    | enum          | No       | `info`    | `debug \| info \| warn \| error`           |
| DATABASE_URL | URL           | Sí       | —         | postgres connection string                 |
| PUBLIC_URL   | URL opcional  | No       | undefined | `""` se convierte a undefined (preprocess) |
| LOKI_URL     | URL opcional  | No       | undefined | `""` se convierte a undefined (preprocess) |

Cada módulo posterior agrega sus líneas (`JWT_SECRET`, `INTUIT_*`, etc.).

### Dependencias externas

- **Cloudflare Tunnel** (`*.kodapp.com.mx`) → Traefik de Coolify → containers.
- **Coolify** (auto-deploy on push, healthchecks, log routing).
- **Postgres 16 + pgvector** (imagen `pgvector/pgvector:pg16`).
- **Redis 7-alpine**.

---

## Decisiones tomadas

Las 7 decisiones están en [v0.1.0.md](v0.1.0.md) y en el índice del [`README.md` raíz del roadmap](../README.md).

- D-mapi-001 — `tsc + tsc-alias` directo, sin `nest build`.
- D-mapi-002 — Prefijo `/v1` con `exclude: ['metrics']`.
- D-mapi-003 — `cleanupOpenApiDoc` de nestjs-zod (no `patchNestjsSwagger`).
- D-mapi-004 — Scalar `layout: 'modern'` + `hideModels: true`.
- D-mapi-005 — Schema env vars con preprocess `emptyToUndefined`.
- D-mapi-006 — DbModule `@Global()` con tokens `DB` y `DB_CLIENT` separados.
- D-mapi-007 — Subdominio prod = `mapi.kodapp.com.mx`.

---

## Tareas

Todas cerradas en v0.1.0. Ver [v0.1.0.md](v0.1.0.md) para el detalle.

- [x] Scaffold NestJS + tsconfigs + eslint + prettier + Dockerfile (P0.3).
- [x] Core: config Zod + logger pino + correlation middleware + domain error filter (P0.4).
- [x] DbModule + HealthModule con `GET /v1/healthz` (P0.5).
- [x] MetricsModule + OpenAPI Scalar (P0.6).
- [x] `docker-compose.yaml` prod validado localmente (P0.10).
- [x] Push a GitHub `git@github.com:alfredomx/bvcpas-project.git`.
- [x] Coolify proyecto + env vars + subdominio `mapi.kodapp.com.mx` + primer deploy (P0.11).

---

## Migración de datos

Ninguna. `00-foundation` arranca con DB vacía.

---

## Smoke test del módulo

Todos pasados al cierre de v0.1.0:

- [x] `https://mapi.kodapp.com.mx/v1/healthz` responde con `env: production`, `db.status: up`.
- [x] `https://mapi.kodapp.com.mx/metrics` responde con formato Prometheus (label `env="production"`).
- [x] `https://mapi.kodapp.com.mx/v1/docs` responde HTTP 200 con UI Scalar funcional (sidebar Health + endpoint expandible).
- [x] `https://mapi.kodapp.com.mx/v1/docs-json` devuelve OpenAPI spec con path `/v1/healthz` + schema `HealthResponseDto`.
- [x] Pre-commit hook bloquea código con `any` explícito, formato prettier inválido, o type error.
- [x] Auto-deploy on push a `main` activo en Coolify (build + up < 4 min).

---

## Notas

- Cualquier módulo nuevo que necesite Auth, primero ese módulo abre AuthModule en su versión, y luego se consume aquí. `00-foundation` no incluye Auth porque ningún módulo de dominio lo ha pedido todavía.
- Cuando entren tablas reales (con v0.2.0 / `20-intuit-oauth`), Drizzle migrations se generan dentro de `apps/mapi/drizzle/migrations/`.
- mapi v0.x legacy sigue corriendo en `mapi.alfredo.mx` hasta que `20-intuit-oauth` migre los 77 clientes.
