# 00-foundation (core) — TDD vivo

> Módulo de **infraestructura** del core. No hace talacha; deja el host booteable solo y la infra lista para que los plugins la consuman.

## Qué resuelve

Que un chat fresco pueda arrancar el core de `mapi_v2`, conectarse a su DB/Redis propios, y tener todas las piezas de infra (config, db, queue, errores, validación, logger, qbo-client, plugin-bridge, jwt-verify, plugin-loader) disponibles — portadas desde `mapi` (probado), no reinventadas.

## Alcance del módulo

| Pieza         | Origen (mapi)                        | Qué es                                         |
| ------------- | ------------------------------------ | ---------------------------------------------- |
| scaffold      | bootstrap mapi                       | NestJS 11 + tooling + health booteable solo    |
| config        | `core/config`                        | env validado por Zod                           |
| db            | `core/db`                            | DbModule `@Global()` (Drizzle + postgres-js)   |
| queue         | `core/queue`                         | QueueModule reusable (BullMQ + ioredis)        |
| errors        | `common/errors`                      | DomainErrorFilter + DomainError base           |
| validation    | `common/pipes`                       | ZodValidationPipe                              |
| logger        | `nestjs-pino` + `common/correlation` | Pino + correlation_id                          |
| qbo-client    | `20-intuit-oauth` (extraído)         | cliente HTTP a QBO con refresh transparente    |
| plugin-bridge | `23-plugin-bridge` (extraído)        | gateway WS hacia el plugin de navegador        |
| jwt-verify    | `10-core-auth` (slim)                | guard que protege endpoints con el token admin |
| plugin-loader | nuevo (no existe en mapi)            | descubre y monta los plugins del registro      |

## Estructura de destino

```
apps/mapi_v2/core/src/
├── (infra de la tabla de arriba)
└── plugin-loader/   ← descubre plugins; el core NUNCA los importa por nombre
```

## DB propia

`mapi_v2_local` / `mapi_v2_prod`, con seed único de referencia (clientes + credenciales) copiado de mapi. El motor es dueño de su data.

## Versiones

| Versión | Estado | Tema                                                       |
| ------- | ------ | ---------------------------------------------------------- |
| v0.1.0  | 🚧     | Scaffold core booteable solo + port infra + DB propia/seed |
