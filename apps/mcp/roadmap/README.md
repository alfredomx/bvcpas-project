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

### 5. `list_client_transactions`

`GET /v1/clients/:id/transactions` — uncats y AMAs del cliente (snapshot de
`client_transactions`). Requiere `clientId` (UUID). `category` distingue: uncats =
`uncategorized_expense`/`uncategorized_income`, AMAs = `ask_my_accountant`. Filtros opcionales
`filter`, `startDate`/`endDate`. (mcp v0.1.2)

### 6. `list_uncats` · 7. `list_amas`

Atajos directos por **nombre de cliente** (resuelven a UUID solos con `?search=`). `list_uncats`
trae los uncats (expense + income, sin AMAs); `list_amas` trae los AMAs (`ask_my_accountant`).
Arg `client` (nombre o UUID) + `startDate`/`endDate` opcionales. Si el nombre coincide con 2+
clientes, error con la lista — no adivina. (mcp v0.1.3)

> **Resolución cliente por nombre (mcp v0.1.4):** `list_uncats`, `list_amas`,
> `list_client_transactions` y `list_client_accounts` aceptan **nombre o UUID** vía un resolver
> compartido (`resolveClientId`) con **cache en memoria** (parcial `ilike`: "sre" → "SRE
> Services, LLC"; 2+ matches → error con lista). `bank_download` resuelve nombres del lado de mapi.

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

| Versión | Estado | Tema                                                                                                                | Archivo                |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 0.1.0   | ✅     | Scaffold app + 4 tools (bank_download + 3 de lectura) sobre stdio contra mapi local                                 | [v0.1.0.md](v0.1.0.md) |
| 0.1.1   | ✅     | Filtros/paginación en tools: `search`/`page`/`pageSize` en list_clients, `portal` en list_client_accounts           | [v0.1.1.md](v0.1.1.md) |
| 0.1.2   | ✅     | Tool `list_client_transactions` — visibilidad de uncats y AMAs por cliente (wrapper de `/clients/:id/transactions`) | [v0.1.2.md](v0.1.2.md) |
| 0.1.3   | ✅     | Tools `list_uncats` y `list_amas` — atajos por nombre de cliente (resuelven UUID solos)                             | [v0.1.3.md](v0.1.3.md) |
| 0.1.4   | ✅     | Resolución cliente→UUID reusable + cache; accounts/transactions también aceptan nombre                              | [v0.1.4.md](v0.1.4.md) |
