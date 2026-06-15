# 96-jobs — Colas (BullMQ) + dashboard (bull-board)

**Estado del módulo**: 🚧 Infra de colas montada (v0.24.0). Sin workers todavía.
**Apertura**: 2026-06-15.

## Norte del módulo

Infra transversal de **colas de trabajo** para la app. Es la **capa 2** del arco de descarga
bancaria (ver `22-bank-worker/v0.22.0.md`): toda descarga (y futuros trabajos largos) pasará por
una cola BullMQ para correr en background, con reintentos, progreso y visibilidad.

- **Cola**: BullMQ (`@nestjs/bullmq`) sobre el mismo Redis del resto de la app (`REDIS_URL`).
- **Dashboard**: bull-board montado en `/v1/admin/queues`, detrás de auth admin (JWT). Muestra
  jobs, estado, progreso, reintentar, borrar — para diagnosticar trabajos lentos (ej. Broadway).
- **Código**: `src/core/queue/` (infra core) + montaje del dashboard en `main.ts`.

## Por qué bull-board (y no un dashboard custom)

En este mapi NO existía cola ni dashboard previo (el de mapi v0.x / otros proyectos es aparte).
bull-board es UI lista (cero código de UI), full-featured (retry/inspect/clean). Se monta **una vez**
y cada cola nueva se **registra en la misma** (no un dashboard por cola).

## Versiones

| Versión | Estado | Tema                                                                   | Archivo                  |
| ------- | ------ | ---------------------------------------------------------------------- | ------------------------ |
| 0.24.0  | 🚧     | Infra: BullMQ + bull-board (`/v1/admin/queues`) + cola `bank-download` | [v0.24.0.md](v0.24.0.md) |

## Próximo

- Wiring de las descargas a la cola (encolar + worker + `updateProgress`) — toda descarga pasa por
  BullMQ (await para chicas, async para batch). Choke point de la regla "1 sesión de banco a la vez".
- Batch/fleet ("descarga todo"), timeout/retry por banco, progreso por-cheque.
