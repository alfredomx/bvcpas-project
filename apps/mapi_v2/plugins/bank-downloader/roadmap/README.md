# Roadmap — `plugins/bank-downloader`

Proceso, índice y decisiones del **plugin Bank Downloader** de `mapi_v2`. Descarga de cheques, depósitos, estados de cuenta y transacciones de los bancos. Design B: los adapters (mapi) tienen el conocimiento de cada banco (endpoints/parsing/recetas de login); kiro es un ejecutor tonto que corre los fetches/DOM en la sesión viva vía el bridge.

> **Arquitectura del sistema:** [`../../../README.md`](../../../README.md) · **Cara pública:** [`../README.md`](../README.md).

> **Decisiones del core** (D-core-NNN): [`../../../core/roadmap/README.md`](../../../core/roadmap/README.md). Aquí van las del plugin (**D-bank-down-NNN**).

---

## Estado actual

El plugin versiona con tags `bank-downloader-vX.Y.Z`, independiente del core y de otros plugins.

- `10-download` ✅ (bank-downloader v0.1.0 — port del descargador del mapi viejo: adapters (Strategy, Chase portado), step-flow de descarga sobre la sesión viva, cola BullMQ `bank-download` (1 sesión a la vez), rutas flat `/v1/bank/download/*`). Consume del core: `BANK_CREDENTIALS_PORT`, `BRIDGE_COMMAND_PORT`, `ClientsService`.
- `10-download` ✅ (bank-downloader v0.1.1 — **errores honestos**: los verbos de descarga ya no se disfrazan de "0 cheques" ante fallos de sesión/bridge/fetch; `searchTransactions` propaga, solo se aíslan fallos por-imagen). **Cerrado 2026-06-18**, tag `bank-downloader-v0.1.1`.
- `10-download` ✅ (bank-downloader v0.1.2 — **pestaña same-origin**: el `BridgeFetchExecutor` abre una pestaña al origen del fetch y reintenta una vez cuando kiro no encuentra pestaña same-origin. El fetch ya llega al endpoint de documentos de Chase). **Cerrado 2026-06-18**, tag `bank-downloader-v0.1.2`.
- `10-download` ✅ (bank-downloader v0.2.0 — **fire-and-forget**: los verbos pesados encolan y devuelven `202 { jobId }`; el worker hace TODO (login → descarga → logout) y persiste siempre. Cierra el orquestador `client-download`). **Cerrado 2026-06-18**, tag `bank-downloader-v0.2.0`.
- `10-download` ✅ (bank-downloader v0.2.1 — **login en la ruta correcta**: `ensureTab` abre el logon FRESCO en vez de reusar una pestaña del mismo host en otra ruta. Descarga real end-to-end confirmada; resuelve el Chase 401). **Cerrado 2026-06-18**, tag `bank-downloader-v0.2.1`.

**Diferidos:** ver [BACKLOG.md](BACKLOG.md) (`accountMasks: "all"`, `GET /jobs/:jobId`, más bancos, eventos cuando el core tenga event_log, Dropbox como destino real).

## Versionado y estados

SemVer `bank-downloader-MAJOR.MINOR.PATCH`. Estados: ✅ Completado · 🚧 En progreso (una a la vez) · 🔬 En discusión · 📅 Planeado.

## Reglas de proceso (heredadas del core)

1. **TDD aprobado por el operador antes de codear.**
2. **No bumpear nada hasta cerrar**; al cerrar: merge `--no-ff` a main + tag `bank-downloader-vX.Y.Z`.
3. **Cero reach:** usa SOLO la API pública del core (puertos + `ClientsService`) + sus propios archivos.
4. Tags git con prefijo `bank-downloader-`.

## Índice de módulos

| Carpeta     | Status | Versiones                                                                                                                                                               |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10-download | ✅     | [v0.1.0](10-download/v0.1.0.md) · [v0.1.1](10-download/v0.1.1.md) · [v0.1.2](10-download/v0.1.2.md) · [v0.2.0](10-download/v0.2.0.md) · [v0.2.1](10-download/v0.2.1.md) |

## Decisiones acumuladas (`D-bank-down-NNN`)

| ID              | Decisión                                                                                                                                                                                                                                                                                                                                    | Versión | Diverge |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| D-bank-down-001 | **UN plugin con adapters dentro** (Strategy): los adapters tienen el conocimiento por banco; el `BankDownloadService` solo orquesta primitivas. Hoy solo Chase portado                                                                                                                                                                      | 0.1.0   | —       |
| D-bank-down-002 | Las credenciales y `clientId` se **derivan del `credentialId`** vía `BANK_CREDENTIALS_PORT` (D-core-027). El caller manda solo `credentialId` + masks; nunca tablas aquí                                                                                                                                                                    | 0.1.0   | —       |
| D-bank-down-003 | Toda descarga pesada pasa por la **cola `bank-download`** (worker `concurrency: 1`): choke point de "1 sesión de banco a la vez" + cierre condicional de sesión                                                                                                                                                                             | 0.1.0   | —       |
| D-bank-down-004 | **Rutas flat** `/v1/bank/download/*`; `clientId` fuera de la ruta (convención de API mapi_v2). Verbos de descarga por cola; `.../list` (preview) síncronos                                                                                                                                                                                  | 0.1.0   | —       |
| D-bank-down-005 | **Sin eventos** (el core aún no tiene `event_log`) y **sin `userId`** en los jobs (mapi_v2 no atribuye por usuario aún). Diverge del mapi viejo                                                                                                                                                                                             | 0.1.0   | Sí      |
| D-bank-down-006 | ~~El verbo único `client-download` y el listado de credenciales se difieren~~ → **el orquestador se cierra en v0.2.0** (el worker hace todo); el listado de credenciales sigue en `bank-credentials`                                                                                                                                        | 0.1.0   | Sí      |
| D-bank-down-007 | **Isolación per-cuenta acotada a fallos por-imagen.** `searchTransactions`/`getDepositDetails` (prueba de sesión) PROPAGAN → el job falla honesto (no se disfraza de "0"). No clasifica tipos de error (cero-reach: no importa los errores del `kiro-bridge`); regla simple: el search es la prueba, lo posterior por-imagen es best-effort | 0.1.1   | —       |
| D-bank-down-008 | **Same-origin en el executor.** kiro corre el fetch en una pestaña del mismo origen; si no la hay, el `BridgeFetchExecutor` abre una al origen del fetch y reintenta UNA vez. Genérico (todos los adapters), cero-reach (usa el `BRIDGE_COMMAND_PORT`). Detecta el caso por substring `same-origin` en `result.error` (contrato con kiro)   | 0.1.2   | —       |
| D-bank-down-009 | **Descargas fire-and-forget.** Los verbos pesados encolan y devuelven `202 { jobId }`; el worker hace TODO (asegura sesión/login → descarga → logout condicional), no asume nada. Cierra el orquestador `client-download` (antes D-bank-down-006). `accounts`/`*/list` siguen síncronos. Resultado/fallo en bull-board                      | 0.2.0   | Sí      |
| D-bank-down-010 | **Persiste siempre** a disco; sin flag `save` (en fire-and-forget no hay respuesta inline). El returnvalue del job = resumen (counts + `saved_dir`), sin base64. Recuperar archivos del `saved_dir` (Dropbox real diferido en BACKLOG)                                                                                                      | 0.2.0   | —       |
| D-bank-down-011 | **`ensureTab` asegura la URL del logon, no solo el host.** Reusar por host dejaba el login en otra ruta (ej. dashboard) donde el form no es alcanzable. Ahora reusa solo si está en la URL exacta del logon; si hay una del mismo host en otra ruta, la cierra y abre fresca. Resuelve el login automático y el Chase 401 (era síntoma)     | 0.2.1   | —       |
