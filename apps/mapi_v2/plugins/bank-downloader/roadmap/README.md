# Roadmap — `plugins/bank-downloader`

Proceso, índice y decisiones del **plugin Bank Downloader** de `mapi_v2`. Descarga de cheques, depósitos, estados de cuenta y transacciones de los bancos. Design B: los adapters (mapi) tienen el conocimiento de cada banco (endpoints/parsing/recetas de login); kiro es un ejecutor tonto que corre los fetches/DOM en la sesión viva vía el bridge.

> **Arquitectura del sistema:** [`../../../README.md`](../../../README.md) · **Cara pública:** [`../README.md`](../README.md).

> **Decisiones del core** (D-core-NNN): [`../../../core/roadmap/README.md`](../../../core/roadmap/README.md). Aquí van las del plugin (**D-bank-down-NNN**).

---

## Estado actual

El plugin versiona con tags `bank-downloader-vX.Y.Z`, independiente del core y de otros plugins.

- `10-download` ✅ (bank-downloader v0.1.0 — port del descargador del mapi viejo: adapters (Strategy, Chase portado), step-flow de descarga sobre la sesión viva, cola BullMQ `bank-download` (1 sesión a la vez), rutas flat `/v1/bank/download/*`). Consume del core: `BANK_CREDENTIALS_PORT`, `BRIDGE_COMMAND_PORT`, `ClientsService`.
- `10-download` ✅ (bank-downloader v0.1.1 — **errores honestos**: los verbos de descarga ya no se disfrazan de "0 cheques" ante fallos de sesión/bridge/fetch; `searchTransactions` propaga, solo se aíslan fallos por-imagen). **Cerrado 2026-06-18**, tag `bank-downloader-v0.1.1`.

**Diferidos:** ver [BACKLOG.md](BACKLOG.md) (verbo único `client-download`/orquestador, listado de credenciales, más bancos, eventos cuando el core tenga event_log).

## Versionado y estados

SemVer `bank-downloader-MAJOR.MINOR.PATCH`. Estados: ✅ Completado · 🚧 En progreso (una a la vez) · 🔬 En discusión · 📅 Planeado.

## Reglas de proceso (heredadas del core)

1. **TDD aprobado por el operador antes de codear.**
2. **No bumpear nada hasta cerrar**; al cerrar: merge `--no-ff` a main + tag `bank-downloader-vX.Y.Z`.
3. **Cero reach:** usa SOLO la API pública del core (puertos + `ClientsService`) + sus propios archivos.
4. Tags git con prefijo `bank-downloader-`.

## Índice de módulos

| Carpeta     | Status | Versiones                                                         |
| ----------- | ------ | ----------------------------------------------------------------- |
| 10-download | ✅     | [v0.1.0](10-download/v0.1.0.md) · [v0.1.1](10-download/v0.1.1.md) |

## Decisiones acumuladas (`D-bank-down-NNN`)

| ID              | Decisión                                                                                                                                                                                                                                                                                                                                    | Versión | Diverge |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| D-bank-down-001 | **UN plugin con adapters dentro** (Strategy): los adapters tienen el conocimiento por banco; el `BankDownloadService` solo orquesta primitivas. Hoy solo Chase portado                                                                                                                                                                      | 0.1.0   | —       |
| D-bank-down-002 | Las credenciales y `clientId` se **derivan del `credentialId`** vía `BANK_CREDENTIALS_PORT` (D-core-027). El caller manda solo `credentialId` + masks; nunca tablas aquí                                                                                                                                                                    | 0.1.0   | —       |
| D-bank-down-003 | Toda descarga pesada pasa por la **cola `bank-download`** (worker `concurrency: 1`): choke point de "1 sesión de banco a la vez" + cierre condicional de sesión                                                                                                                                                                             | 0.1.0   | —       |
| D-bank-down-004 | **Rutas flat** `/v1/bank/download/*`; `clientId` fuera de la ruta (convención de API mapi_v2). Verbos de descarga por cola; `.../list` (preview) síncronos                                                                                                                                                                                  | 0.1.0   | —       |
| D-bank-down-005 | **Sin eventos** (el core aún no tiene `event_log`) y **sin `userId`** en los jobs (mapi_v2 no atribuye por usuario aún). Diverge del mapi viejo                                                                                                                                                                                             | 0.1.0   | Sí      |
| D-bank-down-006 | El verbo único `client-download` (login→masks→descarga→logout en el worker) y el listado de credenciales **se difieren** (BACKLOG): v0.1.0 asume sesión viva ya lista                                                                                                                                                                       | 0.1.0   | Sí      |
| D-bank-down-007 | **Isolación per-cuenta acotada a fallos por-imagen.** `searchTransactions`/`getDepositDetails` (prueba de sesión) PROPAGAN → el job falla honesto (no se disfraza de "0"). No clasifica tipos de error (cero-reach: no importa los errores del `kiro-bridge`); regla simple: el search es la prueba, lo posterior por-imagen es best-effort | 0.1.1   | —       |
