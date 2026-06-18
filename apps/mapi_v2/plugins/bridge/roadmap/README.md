# Roadmap — `plugins/bridge`

Proceso, índice y decisiones del **plugin Bridge** (transporte WS mapi↔kiro) de `mapi_v2`.

> **Arquitectura del sistema:** [`../../../README.md`](../../../README.md) · **Cara pública:** [`../README.md`](../README.md).

> **Decisiones del core** (D-core-NNN): [`../../../core/roadmap/README.md`](../../../core/roadmap/README.md). Aquí van las del plugin (**D-bridge-NNN**).

---

## Estado actual

El plugin versiona con tags `bridge-vX.Y.Z`, independiente del core y de otros plugins.

- `10-bridge` ✅ (bridge v0.1.0 — port del bridge WS: gateway `/bridge` + command service correlacionado + admin endpoints `tabs`/`dom`. Publica `BRIDGE_COMMAND_PORT`).

## Versionado y estados

SemVer `bridge-MAJOR.MINOR.PATCH`. Estados: ✅ Completado · 🚧 En progreso (una a la vez) · 🔬 En discusión · 📅 Planeado.

## Reglas de proceso (heredadas del core)

1. **TDD aprobado por el operador antes de codear.**
2. **No bumpear nada hasta cerrar**; al cerrar: merge `--no-ff` a main + tag `bridge-vX.Y.Z`.
3. **Cero reach:** usa SOLO la API pública del core + sus propios archivos.
4. Tags git con prefijo `bridge-`.

## Índice de módulos

| Carpeta   | Status | Versiones                     |
| --------- | ------ | ----------------------------- |
| 10-bridge | ✅     | [v0.1.0](10-bridge/v0.1.0.md) |

## Decisiones acumuladas (`D-bridge-NNN`)

| ID           | Decisión                                                                                                                                                                                     | Versión | Diverge |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| D-bridge-001 | El bridge es un **plugin propio** que publica `BRIDGE_COMMAND_PORT` en el core (`@Global`, exporta solo el token); los consumidores (`bank-downloader`) inyectan el token (D-core-027)       | 0.1.0   | —       |
| D-bridge-002 | El **protocolo** (comandos / `DomStep` / resultados) vive en `core/src/contracts/bridge.port.ts`: es el contrato compartido mapi↔kiro Y entre plugins                                        | 0.1.0   | —       |
| D-bridge-003 | Auth slim: el `hello` trae el JWT del operador, verificado contra `JWT_SECRET` (como el `AdminGuard`). Sin `SessionsService` (mapi_v2 no tiene sesiones revocables) — diverge del mapi viejo | 0.1.0   | Sí      |
| D-bridge-004 | Una conexión de plugin a la vez (la última gana); multi-plugin diferido. La presencia se limpia solo si el transporte que se va es el activo (no pisa reconexiones)                          | 0.1.0   | —       |
| D-bridge-005 | Timeout de comando **constante** (30s), no env (vs config en el viejo) — evita env bloat                                                                                                     | 0.1.0   | Sí      |
| D-bridge-006 | `WsAdapter` (`@nestjs/platform-ws`, `ws` nativo, no socket.io) agregado al bootstrap del core (`main.ts`)                                                                                    | 0.1.0   | —       |
