import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { Logger as PinoNestLogger } from 'nestjs-pino'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import type { Express } from 'express'
import { AppModule } from './app.module'
import { AppConfigService } from './core/config/config.service'
import { APP_NAME, APP_VERSION } from './common/version'

/**
 * Configura OpenAPI con UI Scalar:
 * - GET /v1/docs       → UI interactiva (Scalar 3-pane).
 * - GET /v1/docs-json  → spec OpenAPI 3 raw para clientes que la consuman.
 *
 * Aplica patch a swagger para que entienda zod schemas vía nestjs-zod.
 */
/**
 * Tags de Scalar/OpenAPI con su displayName (lo que se ve en sidebar).
 *
 * Los nombres internos de tag son únicos a nivel API (`Clients - Admin`,
 * `Clients - Intuit`, etc.) para evitar colisión con tags top-level
 * (`Intuit` solo del proxy V3 vive en otro grupo).
 *
 * `x-displayName` (extensión Scalar/Redoc) permite mostrar el tag con
 * un nombre más corto y limpio en la sidebar:
 *   tag interno = 'Clients - Intuit', visible = 'Intuit'
 *
 * Cuando se agregue un tag nuevo en código, también agregarlo aquí
 * en su lugar lógico. Si falta, OpenAPI lo deja al final por orden de
 * descubrimiento — funciona pero queda fuera del flujo.
 */
const TAG_ORDER: { name: string; displayName?: string; description?: string }[] = [
  // Access Management
  { name: 'Auth', description: 'Login, sesión, password change' },
  { name: 'Users', description: 'CRUD admin de usuarios del sistema' },

  // Client Management — sub-tags con displayName corto (el grupo padre
  // 'Client Management' ya da el contexto en sidebar de Scalar).
  { name: 'Clients - Clients', displayName: 'Clients', description: 'CRUD del cliente' },
  {
    name: 'Clients - Transactions',
    displayName: 'Transactions',
    description: 'Snapshot de transacciones del cliente',
  },
  {
    name: 'Clients - Responses',
    displayName: 'Responses',
    description: 'Respuestas del cliente sobre uncats',
  },
  {
    name: 'Clients - Followups',
    displayName: 'Followups',
    description: 'Status de followups por (cliente × periodo)',
  },
  {
    name: 'Clients - Public Links',
    displayName: 'Public Links',
    description: 'Tokens públicos para que el cliente final responda',
  },
  {
    name: 'Clients - Intuit',
    displayName: 'Intuit',
    description: 'Acciones Intuit sobre el cliente (reconnect, disconnect)',
  },
  {
    name: 'Clients - Uncats',
    displayName: 'Uncats',
    description: 'Detalle de uncats del cliente para el dashboard',
  },

  // Views (sin grupo: solo 1 tag por ahora; cuando entren recon/w-9
  // se agrupan en su propia sección).
  { name: 'Views', description: 'Vistas globales agregadas cross-cliente' },

  // OAuth flows — displayName corto bajo el grupo 'OAuth'.
  {
    name: 'OAuth - Intuit',
    displayName: 'Intuit',
    description: 'Flow OAuth con QuickBooks Online',
  },
  {
    name: 'OAuth - Microsoft',
    displayName: 'Microsoft',
    description: 'Flow OAuth con Microsoft Graph (Outlook)',
  },

  // Providers (acciones admin/uso de la conexión, distinto del flow OAuth).
  { name: 'Intuit API', description: 'Admin: proxy V3 + listado de tokens (sin OAuth)' },
  { name: 'Connections', description: 'Mis conexiones a servicios externos (cross-provider)' },

  // Utils
  { name: 'Public', description: 'Endpoints sin auth (acceso por token)' },
  { name: 'Health', description: 'Liveness check' },
]

/**
 * Agrupación de tags en secciones colapsables de Scalar (extensión
 * `x-tagGroups`). Cada grupo encierra varios tags. Combinado con
 * `x-displayName` por tag, permite jerarquía visual de 2 niveles:
 *
 *   ▾ Clients               (grupo)
 *      ├─ Admin              (tag 'Clients - Admin' con displayName 'Admin')
 *      ├─ Transactions
 *      └─ Intuit
 *
 * Cuando entren más providers (Google, Dropbox) o más sub-recursos
 * del cliente, se agregan a los grupos correspondientes.
 */
const TAG_GROUPS: { name: string; tags: string[] }[] = [
  { name: 'Access Management', tags: ['Auth', 'Users'] },
  {
    name: 'Client Management',
    tags: [
      'Clients - Clients',
      'Clients - Transactions',
      'Clients - Responses',
      'Clients - Followups',
      'Clients - Public Links',
      'Clients - Intuit',
      'Clients - Uncats',
    ],
  },
  // 'Views' queda como tag plano — todavía no se le crea grupo porque
  // tiene un solo tag. Se agrupa cuando entren más vistas (recon, w-9).
  { name: 'OAuth', tags: ['OAuth - Intuit', 'OAuth - Microsoft'] },
  { name: 'Providers', tags: ['Intuit API', 'Connections'] },
  { name: 'Utils', tags: ['Public', 'Health'] },
]

function setupApiDocs(app: INestApplication, cfg: AppConfigService): void {
  const builder = new DocumentBuilder()
    .setTitle('mapi API')
    .setDescription('BV CPAs - backend operativo del bookkeeper')
    .setVersion(APP_VERSION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT obtenido al login' },
      'bearer',
    )

  // Forzar orden de tags en sidebar.
  for (const tag of TAG_ORDER) {
    builder.addTag(tag.name, tag.description ?? '')
  }

  if (cfg.publicUrl) builder.addServer(cfg.publicUrl, 'Tunnel')
  builder.addServer(`http://localhost:${cfg.port}`, 'Local nativo')

  const config = builder.build()
  const rawDocument = SwaggerModule.createDocument(app, config)
  const document = cleanupOpenApiDoc(rawDocument)

  // Inyecta `x-displayName` en los tags que lo necesitan (los sub-tags
  // del cliente se ven como 'Admin', 'Transactions', etc. dentro del
  // grupo 'Clients' en lugar de 'Clients - Admin', 'Clients - Transactions').
  if (document.tags) {
    for (const tag of document.tags) {
      const meta = TAG_ORDER.find((t) => t.name === tag.name)
      if (meta?.displayName) {
        ;(tag as unknown as Record<string, unknown>)['x-displayName'] = meta.displayName
      }
    }
  }

  // Scalar respeta `x-tagGroups` para mostrar la sidebar en secciones
  // colapsables (extensión OpenAPI no estándar pero soportada por Scalar/Redoc).
  ;(document as unknown as Record<string, unknown>)['x-tagGroups'] = TAG_GROUPS

  const httpAdapter = app.getHttpAdapter()
  const expressApp = httpAdapter.getInstance() as Express

  expressApp.get('/v1/docs-json', (_req, res) => {
    res.json(document)
  })

  expressApp.use(
    '/v1/docs',
    apiReference({
      content: document,
      layout: 'modern',
      theme: 'default',
      hideModels: true,
      hideClientButton: false,
      defaultOpenAllTags: false,
      authentication: { preferredSecurityScheme: 'bearer' },
    }),
  )
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(PinoNestLogger))

  app.setGlobalPrefix('v1', { exclude: ['metrics'] })
  app.enableCors()
  app.enableShutdownHooks()

  const cfg = app.get(AppConfigService)
  setupApiDocs(app, cfg)

  await app.listen(cfg.port)

  const lines = [
    '════════════════════════════════════════',
    `  ${APP_NAME}@${APP_VERSION}`,
    `  NODE_ENV   ${cfg.nodeEnv}`,
    `  PORT       ${cfg.port}`,
    `  API        http://localhost:${cfg.port}/v1`,
    `  Health     http://localhost:${cfg.port}/v1/healthz`,
    `  Metrics    http://localhost:${cfg.port}/metrics`,
    `  Docs       http://localhost:${cfg.port}/v1/docs`,
    cfg.publicUrl ? `  PUBLIC_URL ${cfg.publicUrl}` : null,
    '════════════════════════════════════════',
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  console.log(lines)
}

bootstrap().catch((err: unknown) => {
  console.error('[bootstrap] failed:', err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
