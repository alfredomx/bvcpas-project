# 23-plugin-bridge — WebSocket gateway hacia el plugin (kiro)

**Estado del módulo**: ✅ v0.17.0 (bridge + execute_fetch), v0.19.0 (auth JWT + list_tabs, Fase 1) y v0.20.0 (Fase 2: comando `execute_dom` + endpoints admin `POST /v1/bridge/tabs` y `/v1/bridge/dom`) cerradas.
**Contraparte cliente**: [`apps/kiro/roadmap/10-bridge-client`](../../../kiro/roadmap/10-bridge-client/README.md).

> Reemplaza las referencias viejas a `20-intuit/02-bridge` / `21-intuit-bridge` (planeadas,
> nunca construidas). El bridge es **genérico** (no intuit): canal de comandos mapi↔plugin.

## Norte del módulo

mapi necesita **mandarle comandos al plugin** (kiro) y recibir respuestas, en vivo. Este módulo
es el **WebSocket gateway** server-side: el plugin se conecta como cliente, se autentica, y mapi
le manda `execute_fetch` / `check_session` y espera la respuesta correlacionada. Es la base de
todo el flujo de descarga bancaria (Design B): la lógica vive en mapi, el plugin ejecuta.

## Por qué WebSocket (no polling)

Un adapter pagina → decenas de fetches secuenciales por descarga. Con polling sería lentísimo.
Con WS mapi manda fetch → plugin responde → mapi manda el siguiente. Bidireccional, pronto.

## Alcance (qué construye este módulo)

### Gateway WS

- `@WebSocketGateway` (NestJS + `@nestjs/platform-ws` + `ws`). Ruta `/bridge`.
  Local `ws://localhost:4000/bridge`, prod `wss://mapi.kodapp.com.mx/bridge`.
- **Auth al conectar (shared secret)**: primer mensaje `{ type:'hello', secret, clientInfo }`.
  mapi valida `secret` contra `BRIDGE_SECRET` (env). Si no coincide → cierra la conexión.
  (JWT diferido — ver BACKLOG; shared secret es el patrón ya previsto en kiro.)
- **Presencia**: trackea la(s) conexión(es) de plugin activas. Expone "¿hay plugin conectado?"
  a otros módulos (22-bank-worker lo consulta antes de mandar comandos).

### `BridgeCommandService`

- `send(command): Promise<result>` — asigna `correlationId`, manda
  `{ type, correlationId, payload }` al plugin, y resuelve cuando llega
  `{ type:'result', correlationId, payload }` (timeout configurable).
- Comandos: `execute_fetch` (`{method,url,headers?,body?}`) y `check_session` (`{bank}`).
- Errores: `BridgeNotConnectedError` (no hay plugin), `BridgeCommandTimeoutError`.

### Protocolo de mensajes (RPC)

```
plugin→mapi:  { type:'hello', secret, clientInfo }
mapi→plugin:  { type:'execute_fetch', correlationId, payload:{ method,url,headers,body } }
mapi→plugin:  { type:'check_session', correlationId, payload:{ bank } }
plugin→mapi:  { type:'result', correlationId, payload:{ ...resultado } }
```

> `correlationId` (transporte) === `requestId` del executor de kiro. Mismo concepto.

## Lo que NO entra

- Lógica de bancos / adapters (→ 22-bank-worker v0.18.0).
- MCP / jobs (→ 22-bank-worker v0.19.0).
- OTP inbound (→ v0.20.0).

## Dependencias nuevas

`@nestjs/websockets`, `@nestjs/platform-ws`, `ws`, `@types/ws`.

## Decisiones (D-mapi-B-NNN)

| ID         | Decisión                                                                                           | Estado                   |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------ |
| D-mapi-B01 | Módulo `23-plugin-bridge` (genérico), reemplaza `21-intuit-bridge`/`20-intuit/02-bridge` planeados | **A confirmar (naming)** |
| D-mapi-B02 | Transporte WebSocket (no polling) — adapters paginan, decenas de fetches                           | Firme                    |
| D-mapi-B03 | Auth shared secret (`BRIDGE_SECRET`), JWT diferido                                                 | Firme (patrón previsto)  |
| D-mapi-B04 | `correlationId` correlaciona request↔response; timeout configurable                                | Firme                    |

## Nota MV3 (importante)

El service worker del plugin se duerme en idle → la conexión WS se cae cuando el plugin está
inactivo. El gateway tolera reconexiones; mapi solo manda comandos cuando hay plugin conectado
(en el flujo real el usuario está presente disparando desde Claude, así que el SW está despierto).
El keepalive/reconnect vive del lado kiro (`10-bridge-client`).

## Tests

- Tipo A: `BridgeCommandService` correlaciona por `correlationId`, hace timeout, lanza
  `BridgeNotConnectedError` sin plugin (con un socket mockeado).
- Tipo B (smoke): un cliente WS de prueba se conecta, autentica, recibe `execute_fetch` y responde;
  mapi resuelve la promesa.

## Versiones

| Versión | Estado | Tema                                                                                                                                            |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.17.0  | ✅     | Gateway WS + auth shared secret + presencia + BridgeCommandService (execute_fetch/check_session) — verificado en vivo con kiro v0.2.0           |
| 0.19.0  | ✅     | Fase 1 browser-automation: auth JWT (retira BRIDGE_SECRET) + `list_tabs` (plugin stateless) — verificado en vivo con kiro v0.3.0                |
| 0.20.0  | ✅     | Fase 2: comando `execute_dom` (manda recetas DOM como DATA) + endpoints admin `POST /v1/bridge/tabs` y `/v1/bridge/dom` — espejo de kiro v0.4.0 |
