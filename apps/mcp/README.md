# apps/mcp — Servidor MCP (conector → mapi)

Wrapper MCP delgado: expone verbos de mapi como **tools** para que un agente/LLM los use.
No tiene lógica de negocio — reenvía a endpoints que mapi ya expone. Ver el TDD en
[`roadmap/README.md`](roadmap/README.md).

## Setup

```bash
cd apps/mcp
npm install
cp .env.example .env   # pega MAPI_JWT (el ADMIN_JWT_SECRET de apps/mapi/.env)
```

`MAPI_BASE_URL` default `http://localhost:4000` (mapi local debe estar corriendo).

## Correr (stdio)

```bash
npm run mcp        # arranca el server MCP por stdio
```

Logs van a **stderr** (stdout es del protocolo MCP).

## Probar con MCP Inspector

```bash
npx @modelcontextprotocol/inspector npm --prefix apps/mcp run mcp
```

(o configura el comando `npm run mcp` con cwd `apps/mcp` y las env vars). En el Inspector:

- `list_clients` → debe listar tus clientes.
- `bank_download` con
  `{ "client": "bilia", "what": "statements", "params": { "from": "2026-02", "to": "2026-02", "save": true } }`
  → 202 con el job; el PDF de febrero queda en `apps/mapi/.downloads/`.

## Conectar a Claude Desktop (opcional)

En `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bvcpas": {
      "command": "npm",
      "args": ["--prefix", "RUTA_ABS/apps/mcp", "run", "mcp"],
      "env": { "MAPI_BASE_URL": "http://localhost:4000", "MAPI_JWT": "<jwt-admin>" }
    }
  }
}
```

## Tools (v0.1.0)

| Tool                   | Endpoint mapi                             | Para qué                                                                                         |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `bank_download`        | `POST /v1/banking/download`               | Descarga bancaria por cliente(s) (statements por rango from/to, checks, deposits, transactions). |
| `list_clients`         | `GET /v1/clients`                         | Lista clientes.                                                                                  |
| `list_portals`         | `GET /v1/banking/portals`                 | Portales bancarios.                                                                              |
| `list_client_accounts` | `GET /v1/clients/:id/banking/credentials` | Bancos conectados de un cliente.                                                                 |

## Scripts

`npm run test` (vitest, mock fetch) · `npm run typecheck` · `npm run lint`
