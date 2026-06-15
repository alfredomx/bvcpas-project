/**
 * Entrypoint del servidor MCP (transporte stdio). Registra los tools y los conecta a mapi.
 * IMPORTANTE: en stdio, stdout es del protocolo MCP — todo log va a stderr.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { MapiClient, MapiError } from './mapi-client.js'
import { TOOLS, TOOLS_BY_NAME } from './tools.js'

/** Carga apps/mcp/.env si existe (Node nativo, sin dep). No falla si no hay archivo. */
function loadEnv(): void {
  try {
    process.loadEnvFile()
  } catch {
    // sin .env → se usan las env vars ya presentes en el entorno
  }
}

function loadConfig(): { baseUrl: string; jwt: string } {
  loadEnv()
  const baseUrl = process.env.MAPI_BASE_URL ?? 'http://localhost:4000'
  const jwt = process.env.MAPI_JWT
  if (!jwt) {
    console.error('[mcp] Falta MAPI_JWT en el entorno (JWT admin de mapi).')
    process.exit(1)
  }
  return { baseUrl, jwt }
}

async function main(): Promise<void> {
  const cfg = loadConfig()
  const client = new MapiClient(cfg)

  const server = new Server(
    { name: 'bvcpas-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS_BY_NAME[req.params.name]
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool desconocido: ${req.params.name}` }],
        isError: true,
      }
    }
    try {
      const text = await tool.handler(req.params.arguments ?? {}, client)
      return { content: [{ type: 'text', text }] }
    } catch (err) {
      const msg = err instanceof MapiError || err instanceof Error ? err.message : String(err)
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[mcp] servidor MCP listo (stdio) → mapi ${cfg.baseUrl}`)
}

main().catch((err: unknown) => {
  console.error('[mcp] fallo al iniciar:', err)
  process.exit(1)
})
