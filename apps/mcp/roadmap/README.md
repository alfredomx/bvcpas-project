# apps/mcp — Servidor MCP (conector LLM → mapi)

App nueva del monorepo. Es la **capa conector** que el roadmap de bank-worker siempre
describió como "versión propia" (capa 5 del plan): expone los verbos de mapi como
**tools MCP** para que un agente/LLM los invoque, en vez de que el LLM arme el HTTP a mano.

**Decisión de arranque (operador, 2026-06-15):** se hace como **app separada** (`apps/mcp`)
para probarla sin meter ruido en mapi. Según cómo funcione, se mantiene separada o se
integra en mapi como módulo. Versionado e independencia propios (tag `mcp-vX.Y.Z`).

## Qué es / qué NO es

- **Wrapper delgado.** NO reimplementa lógica: cada tool reenvía a un endpoint que mapi
  YA expone. Toda la lógica de negocio (resolver cliente, escoger credencial, login,
  filtro de rango, logout) vive en mapi.
- **NO toca el código de mapi.** Solo lo consume por HTTP.

## Arquitectura

```
Agente/LLM (Claude Desktop, MCP Inspector, futuro bot)
        │  (protocolo MCP)
        ▼
  apps/mcp  ── HTTP (Authorization: Bearer <JWT admin>) ──▶  mapi  /v1/...
```

- **Stack:** Node + TypeScript + `@modelcontextprotocol/sdk` (oficial). Sin NestJS
  (sería sobrepeso para un wrapper). Mismo tooling del monorepo (eslint/prettier/tsconfig,
  cubierto por lint-staged en raíz).
- **Transporte:** `stdio` para la prueba local AHORA (Claude Desktop / MCP Inspector).
  El mismo código admite agregar transporte HTTP/SSE cuando vaya a HTTPS — los tools se
  definen una sola vez. (Capa de transporte = entrypoint, no cambia los tools.)
- **Cliente HTTP a mapi:** `fetch` nativo. Base URL y token por env.

## Configuración (env de apps/mcp)

| Var             | Default                 | Para qué                                                                            |
| --------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `MAPI_BASE_URL` | `http://localhost:4000` | A dónde apunta el wrapper. Prod: `https://mapi.kodapp.com.mx`.                      |
| `MAPI_JWT`      | —                       | JWT admin para `Authorization: Bearer`. Local: el mismo `ADMIN_JWT_SECRET` de mapi. |

> Local: el operador pega el JWT admin. Cuando vaya a HTTPS se decide el flujo real
> (login del MCP, service token). Diferido — no bloquea la prueba.

## Tools (v0.1.0 — Download + lectura)

Cada tool valida sus args con un JSON Schema, llama al endpoint, y devuelve el JSON de
mapi tal cual (o un error legible). El LLM traduce lenguaje natural → args.

### 1. `bank_download`

Envuelve `POST /v1/banking/download` (orquestador batch, async por la cola).

| Arg      | Tipo                                                       | Notas                                                                 |
| -------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `client` | `string \| string[]`                                       | nombre(s) o UUID. mapi resuelve.                                      |
| `what`   | `'statements' \| 'checks' \| 'deposits' \| 'transactions'` | qué bajar.                                                            |
| `params` | objeto                                                     | según `what`. Statements: `{ from?, to?, latest?, save? }` (YYYY-MM). |

Devuelve el `{ what, jobs: [...] }` de mapi (202). El avance se ve en bull-board.

### 2. `list_clients`

`GET /v1/clients` — lista de clientes (id, nombre, realm, tier, status). Para que el
agente descubra a quién puede bajarle antes de disparar.

### 3. `list_portals`

`GET /v1/banking/portals` — portales bancarios disponibles (Chase, etc.).

### 4. `list_client_accounts`

`GET /v1/clients/:id/banking/credentials` — credenciales/portales de un cliente (qué
bancos tiene conectados). Requiere `clientId`.

## Decisiones

- **D-mcp-001** — App separada `apps/mcp` (no embebida en mapi) para la prueba inicial.
  Trade-off aceptado: otra app + JWT para hablarle a mapi, a cambio de cero ruido en el
  backend y stdio local nativo. Reevaluar integrar a mapi según resultado.
- **D-mcp-002** — Wrapper delgado: los tools solo reenvían a endpoints existentes; cero
  lógica de negocio duplicada. Si un tool necesitara algo que mapi no expone, primero se
  agrega el endpoint en mapi.
- **D-mcp-003** — Transporte stdio primero; HTTP/SSE se agrega como entrypoint adicional
  sin reescribir tools, cuando se deployee a HTTPS.
- **D-mcp-004** — Auth por `MAPI_JWT` (Bearer) en env. El flujo real de token para el
  modo HTTPS se difiere (BACKLOG).

## Fuera de alcance (BACKLOG)

- Transporte HTTP/SSE + deploy en Coolify (`mcp.kodapp.com.mx` o ruta en mapi).
- Flujo de auth propio del MCP para prod (login / service token, no JWT pegado a mano).
- Tools de step-flow fino (`checks/deposits/transactions` por cuenta con rango).
- Tools de escritura a QBO / otros providers.

## Versiones

| Versión | Estado | Tema                                                                                | Archivo                |
| ------- | ------ | ----------------------------------------------------------------------------------- | ---------------------- |
| 0.1.0   | 🚧     | Scaffold app + 4 tools (bank_download + 3 de lectura) sobre stdio contra mapi local | [v0.1.0.md](v0.1.0.md) |
