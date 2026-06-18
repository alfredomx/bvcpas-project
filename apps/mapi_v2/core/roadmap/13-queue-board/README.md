# `13-queue-board` — dashboard de colas (bull-board)

TDD vivo del módulo. Observabilidad de las colas BullMQ: ver jobs (waiting/active/completed/failed), payload, resultado, reintentos — en vez de adivinar.

> Arquitectura del sistema: [`../../../README.md`](../../../README.md) · Proceso/decisiones del core: [`../README.md`](../README.md).

---

## Norte

El operador necesita **ver el proceso completo** de las descargas: que un `checks`/`deposits` se encoló, lo tomó el worker, terminó o falló, con su payload y resultado. Sin dashboard eso era invisible (solo logs).

## Decisión clave — cero-reach (D-core-028)

El core monta **UN** bull-board, pero **no conoce las colas** (cada una es de un plugin/pipe). Para no hardcodear nombres de plugin en el core:

- El core publica un `QueueBoardRegistry` (`@Global`, vía `QueueModule`).
- Cada plugin/pipe que declara una cola (`BullModule.registerQueue`) **registra su nombre** en el registro (en el constructor de algún provider — corre durante `NestFactory.create`).
- El **bootstrap** lee el registro, resuelve cada cola del contenedor (`getQueueToken(name)`) y la agrega al board.

Así el core no nombra `bank-download`; el plugin lo aporta. El board crece solo cuando entra una cola nueva.

## Montaje y auth

- Montado como **middleware Express** (`expressApp.use('/v1/admin/queues', router)`) → **NO pasa por el `AdminGuard` de Nest**.
- **Público** (local-only): el browser no manda `Authorization: Bearer` fácil y mapi_v2 aún no tiene auth real. Asegurarlo queda en el [BACKLOG](../BACKLOG.md) (cuando entre el módulo de auth).
- Deps: `@bull-board/api`, `@bull-board/express` (v8, igual que el mapi viejo).

## Alcance

- `core/src/core/queue/queue-board.registry.ts` — `QueueBoardRegistry`.
- `core/src/core/queue/queue.module.ts` — `@Global`, provee + exporta el registro.
- `core/src/main.ts` — `setupQueueDashboard(app)`: lee el registro, arma el board, lo monta público; línea `Queues` en el banner.
- Plugins/pipes con cola: 1 línea (`board.register(<queue>)`) en un provider. `bank-downloader` registra `bank-download`.

## Verificación

- `GET /v1/admin/queues` → 200 (UI HTML), público.
- API del board lista `bank-download` (descubierta vía el registro, no hardcodeada).
- Disparar un `checks` → el job aparece en el dashboard con payload + resultado.
- typecheck/lint limpios; suite 122 verde (sin tests nuevos: es infra/UI, verificación por smoke — como kiro-bridge).
