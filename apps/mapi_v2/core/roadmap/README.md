# Roadmap — `core` (sistema base / host de plugins)

Proceso, índice y decisiones del **core** de `mapi_v2`. El core bootea solo y provee la infraestructura que los plugins consumen.

> **Arquitectura del sistema (host + plugins, reglas, cómo se enchufa un plugin):** [`../../README.md`](../../README.md) — léelo primero, siempre.

> **Items diferidos:** [`BACKLOG.md`](BACKLOG.md).

> Cada plugin tiene su propio roadmap en `apps/mapi_v2/plugins/<plugin>/roadmap/`.

---

## Estado actual

**Versión `package.json`: `0.1.0`.**

- `00-foundation` 🚧 (v0.1.0 — el core como **substrato mínimo**: config, db, redis, queue, errores/validación/logger, registro explícito + auth slim).

Hecho: config + db, queue (BullMQ + Redis), errores + validación + logger. Falta: registro explícito (cómo se monta un plugin/pipe) + jwt-verify slim.

**Próximo (cuando cierre la fundación):** `plugins/intuit` — **primer plugin** (qbo-client + tokens + clients + config `INTUIT_*`). Todo lo de QuickBooks vive en el plugin, no en el core.

## Estructura de `roadmap/`

```
core/roadmap/
├── README.md          ← este archivo (proceso + índice + decisiones del core)
├── BACKLOG.md         ← diferidos por trigger
└── 00-foundation/     ← scaffold + port del core 🚧 v0.1.0
    ├── README.md      ← TDD vivo
    └── v0.1.0.md      ← bitácora de la versión activa
```

## Versionado y estados

SemVer `MAJOR.MINOR.PATCH`. No hay v1.0.0. Versiones por unidad (el core versiona independiente de cada plugin).

| Emoji | Estado       | Significado                                    |
| ----- | ------------ | ---------------------------------------------- |
| ✅    | Completado   | Cerrado, en main, taggeado (`core-vX.Y.Z`)     |
| 🚧    | En progreso  | Trabajo activo. **Una versión `🚧` a la vez.** |
| 🔬    | En discusión | TDD en revisión                                |
| 📅    | Planeado     | Archivo existe, trabajo no empezado            |

## Reglas de proceso

1. **Solo una versión `🚧` a la vez** (excepción: hotfix que pausa la activa).
2. **No bumpear `package.json` hasta cerrar.**
3. **El TDD manda** salvo decisión documentada (`D-core-NNN`).
4. **Cada commit toca una sola unidad** (core o un plugin) y solo cosas de su versión activa.
5. **Tags git con prefijo `core-`** (`core-v0.1.0`).
6. Las **5 reglas de arquitectura** del README de arriba aplican a todo.

## Cómo cerrar una versión

1. TODOs en `[x]`, todo en main.
2. Marca el archivo `✅`, "Cerrado: YYYY-MM-DD".
3. Bumpea `package.json` `version`.
4. Actualiza tablas de versiones + decisiones de este README.
5. Commit `release(core): vX.Y.Z — [título]` → push `main` → `git tag core-vX.Y.Z && git push --tags`.

---

## Índice de módulos del core

| Carpeta       | Status | TDD                                  | Versiones                         |
| ------------- | ------ | ------------------------------------ | --------------------------------- |
| 00-foundation | 🚧     | [README.md](00-foundation/README.md) | [v0.1.0](00-foundation/v0.1.0.md) |

## Versiones (orden cronológico)

| Versión | Módulo        | Estado | Tema                                                   | Tag         | Archivo                                            |
| ------- | ------------- | ------ | ------------------------------------------------------ | ----------- | -------------------------------------------------- |
| 0.1.0   | 00-foundation | 🚧     | Core substrato: infra + registro explícito + auth slim | (pendiente) | [00-foundation/v0.1.0.md](00-foundation/v0.1.0.md) |

## Decisiones acumuladas (`D-core-NNN`)

| ID         | Decisión                                                                                                                                                                                                                                                                                                                                                       | Versión | Diverge |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| D-core-001 | Sistema core+plugins+pipes: el core bootea solo y NUNCA importa un plugin/pipe por nombre; los monta por registro                                                                                                                                                                                                                                              | 0.1.0   | —       |
| D-core-002 | `mapi` congelado como demo; la infra se **porta** pieza por pieza, no se toca mapi                                                                                                                                                                                                                                                                             | 0.1.0   | —       |
| D-core-003 | Stack reusado de mapi probado (NestJS 11 + BullMQ 5 + Drizzle + ioredis + nestjs-zod + Pino)                                                                                                                                                                                                                                                                   | 0.1.0   | No      |
| D-core-004 | `tsc + tsc-alias` directo, sin `nest build` (heredado mapi D-mapi-001)                                                                                                                                                                                                                                                                                         | 0.1.0   | No      |
| D-core-005 | Prefijo global `/v1` (heredado mapi D-mapi-002)                                                                                                                                                                                                                                                                                                                | 0.1.0   | No      |
| D-core-006 | Puerto `4200` por defecto — coexiste con mapi (local 4000 / prod docker 4100)                                                                                                                                                                                                                                                                                  | 0.1.0   | No      |
| D-core-007 | Nombre de paquete `mapi_v2-core` (etiqueta privada, no se publica)                                                                                                                                                                                                                                                                                             | 0.1.0   | No      |
| D-core-008 | QueueModule registra SOLO la conexión raíz de BullMQ; las colas de dominio las declara cada plugin/pipe                                                                                                                                                                                                                                                        | 0.1.0   | —       |
| D-core-009 | `REDIS_URL` con índice db **3** (distinto al de mapi); evita colisión de colas en el Redis local                                                                                                                                                                                                                                                               | 0.1.0   | No      |
| D-core-010 | `REDIS_CLIENT` (ioredis raw) separado de BullMQ; cierra al shutdown como el pool de Postgres                                                                                                                                                                                                                                                                   | 0.1.0   | No      |
| D-core-011 | `DomainError` carga su propio `status` HTTP; sin mapa central `STATUS_BY_CODE` (el core es ciego a los códigos de los plugins)                                                                                                                                                                                                                                 | 0.1.0   | Sí      |
| D-core-012 | `correlation_id` en cada log de Pino y en el cuerpo de cada error (cruzar error visto vs logs)                                                                                                                                                                                                                                                                 | 0.1.0   | No      |
| D-core-013 | Tres categorías: **core** (substrato) / **plugins** (dominio: dueños de sus tablas, config, errores, migraciones) / **pipes** (procesos sobre BullMQ). Se montan en el core por el registro                                                                                                                                                                    | 0.1.0   | —       |
| D-core-014 | **Manifiesto uniforme `Unit` + registro con validación al boot** (inspirado en c9/architect). Cada plugin/pipe exporta `{ name, kind, module, config }`; el registro es una lista explícita que valida la config Zod al arranque (fail-fast claro) y monta los módulos. Auto-discovery diferido al 2º plugin (el valor es el manifiesto, no el descubrimiento) | 0.1.0   | —       |
| D-core-015 | `qbo-client`/Intuit NO es core → es el **primer plugin** (`plugins/intuit`). El core no lleva config `INTUIT_*` ni tabla `clients`; eso vive en el plugin con su Zod y sus migraciones                                                                                                                                                                         | 0.1.0   | —       |
| D-core-016 | Deps compartidas (opción A): un solo package.json + node_modules en apps/mapi_v2/ (sin workspaces). El core/ ya no es proyecto propio (solo código + roadmap); el host compila core+plugins+pipes a dist/, entry dist/core/src/main.js                                                                                                                         | 0.1.0   | —       |
| D-core-017 | Dev runner tsc-watch (no nest start): el layout multi-carpeta no permite nest start limpio. Fuera @nestjs/cli, @nestjs/schematics, nest-cli.json, tsx, tsconfig-paths; dentro tsc-watch                                                                                                                                                                        | 0.1.0   | —       |
