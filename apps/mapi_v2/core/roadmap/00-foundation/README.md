# 00-foundation (core) — TDD vivo

> Módulo de **substrato** del core. No hace dominio; deja el host booteable solo y la infra mínima lista para que plugins y pipes se monten encima.

## Qué resuelve

Que un chat fresco pueda arrancar el core de `mapi_v2`, conectarse a su DB/Redis propios, y tener el substrato mínimo (config, db, redis, queue, errores, validación, logger, registro explícito, auth slim) — portado desde `mapi` (probado), no reinventado. **Nada de dominio vive aquí** (Intuit, bancos, tokens, clientes son plugins).

## Alcance del módulo

| Pieza      | Origen (mapi)                        | Qué es                                                                                              |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| scaffold   | bootstrap mapi                       | NestJS 11 + tooling + health booteable solo ✅                                                      |
| config     | `core/config`                        | env del **core** validado por Zod (no vars de plugin) ✅                                            |
| db         | `core/db`                            | DbModule `@Global()` — conexión Postgres compartida ✅                                              |
| redis      | `core/auth/redis`                    | `REDIS_CLIENT` (ioredis) para health/locks/cache ✅                                                 |
| queue      | `core/queue`                         | QueueModule (BullMQ root) — substrato de los pipes ✅                                               |
| errors     | `common/errors`                      | DomainError (status propio) + DomainErrorFilter global ✅                                           |
| validation | `common/pipes`                       | ZodValidationPipe (por-ruta) ✅                                                                     |
| logger     | `nestjs-pino` + `common/correlation` | Pino + correlation_id (en logs y en errores) ✅                                                     |
| registro   | `core/registry`                      | contrato `ModuleDef` (manifiesto uniforme) + registro que valida config al boot y monta la lista ✅ |
| jwt-verify | `common/auth` (slim)                 | `AdminGuard` global (`APP_GUARD`) + `@Public()`; protege endpoints con el token admin ✅            |

## Lo que NO va en el core (se mudó a plugin)

- **qbo-client / Intuit OAuth / tokens / tabla `clients` / config `INTUIT_*`** → `plugins/intuit` (primer plugin). El core no sabe de QuickBooks.
- **bridge** (WS al plugin de navegador) → del plugin que lo necesite (Intuit interno / bank), o se promueve al core si 2 plugins lo comparten.
- **seed de clientes/credenciales** → del plugin Intuit (los "clientes" son de QBO).

## Estructura de destino

```
apps/mapi_v2/core/src/
├── core/        ← config, db, redis, queue
├── common/      ← errors, pipes (validación), correlation, auth (jwt-verify slim)
├── modules/     ← health
└── registry/    ← monta la lista explícita de plugins/pipes (el core nunca los importa por nombre)
```

## DB

El core es dueño de la **conexión** a `mapi_v2_local` / `mapi_v2_prod`. **No define tablas de dominio.** Cada plugin trae sus tablas + sus migraciones. (Convención de migraciones por plugin sobre un mismo Postgres: pendiente en BACKLOG, se aterriza con el primer plugin.)

## Versiones

| Versión | Estado | Tema                                                   |
| ------- | ------ | ------------------------------------------------------ |
| v0.1.0  | 🚧     | Core substrato: infra + registro explícito + auth slim |
