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
function setupApiDocs(app: INestApplication, cfg: AppConfigService): void {
  const builder = new DocumentBuilder()
    .setTitle('mapi API')
    .setDescription('BV CPAs - backend operativo del bookkeeper')
    .setVersion(APP_VERSION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT obtenido al login' },
      'bearer',
    )

  if (cfg.publicUrl) builder.addServer(cfg.publicUrl, 'Tunnel')
  builder.addServer(`http://localhost:${cfg.port}`, 'Local nativo')

  const config = builder.build()
  const rawDocument = SwaggerModule.createDocument(app, config)
  const document = cleanupOpenApiDoc(rawDocument)

  const httpAdapter = app.getHttpAdapter()
  const expressApp = httpAdapter.getInstance() as Express

  expressApp.get('/v1/docs-json', (_req, res) => {
    res.json(document)
  })

  expressApp.use(
    '/v1/docs',
    apiReference({
      content: document,
      theme: 'default',
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
