import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { getQueueToken } from '@nestjs/bullmq'
import { WsAdapter } from '@nestjs/platform-ws'
import { Logger as PinoNestLogger } from 'nestjs-pino'
import type { Express, Router } from 'express'
import type { Queue } from 'bullmq'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { AppModule } from './app.module'
import { AppConfigService } from '@/core/config/config.service'
import { DomainErrorFilter } from '@/common/errors/domain-error.filter'
import { QueueBoardRegistry } from '@/core/queue/queue-board.registry'
import { REGISTRY, assertRegistryConfig } from '@/registry/registry'
import { APP_NAME, APP_VERSION } from './common/version'

/**
 * Monta bull-board en `/v1/admin/queues` (D-core-028). **Público** (local-only):
 * el browser no manda `Authorization: Bearer` fácil y mapi_v2 aún no tiene auth
 * real; asegurarlo queda en el BACKLOG para cuando entre el módulo de auth.
 *
 * Cero-reach: el core no conoce las colas. Lee el `QueueBoardRegistry` (lo llenan
 * los plugins/pipes en sus constructores), resuelve cada cola del contenedor y la
 * agrega al board. Se monta como middleware Express → NO pasa por el guard de Nest.
 */
function setupQueueDashboard(app: INestApplication): void {
  const names = app.get(QueueBoardRegistry).list()
  const expressApp = app.getHttpAdapter().getInstance() as Express
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath('/v1/admin/queues')
  const queues = names.map(
    (name) => new BullMQAdapter(app.get<Queue>(getQueueToken(name), { strict: false })),
  )
  createBullBoard({ queues, serverAdapter })
  expressApp.use('/v1/admin/queues', serverAdapter.getRouter() as Router)
}

/**
 * Bootstrap del CORE (host de plugins). Reducido a propósito en este corte:
 * - Config validado por Zod (falla el boot si el env está mal).
 * - DB (Drizzle) — el healthz la checa.
 * - Pino como logger (con correlation_id por request).
 * - DomainErrorFilter global (formato de error JSON homogéneo).
 * - Prefijo global `/v1` + shutdown hooks (cierra el pool de Postgres).
 *
 * El plugin-loader, queue, Scalar, bull-board y el WS adapter se agregan
 * cuando el core/plugins que los necesitan entren en sus propios commits.
 */
async function bootstrap(): Promise<void> {
  // Fail-fast: valida la config (Zod) de cada plugin/pipe del registro contra
  // el env antes de levantar Nest. Si falta una var, muere aquí con error claro.
  assertRegistryConfig(REGISTRY, process.env)

  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(PinoNestLogger))

  app.setGlobalPrefix('v1')
  app.enableCors()
  app.useGlobalFilters(new DomainErrorFilter())
  // El plugin `kiro-bridge` usa un WebSocketGateway sobre `ws` (no socket.io).
  app.useWebSocketAdapter(new WsAdapter(app))
  app.enableShutdownHooks()
  setupQueueDashboard(app)

  const cfg = app.get(AppConfigService)
  await app.listen(cfg.port)

  const lines = [
    '════════════════════════════════════════',
    `  ${APP_NAME}@${APP_VERSION}`,
    `  NODE_ENV   ${cfg.nodeEnv}`,
    `  PORT       ${cfg.port}`,
    `  Health     http://localhost:${cfg.port}/v1/healthz`,
    `  Queues     http://localhost:${cfg.port}/v1/admin/queues`,
    `  Registro   ${REGISTRY.length} (${REGISTRY.map((d) => d.name).join(', ') || 'core booteable solo'})`,
    '════════════════════════════════════════',
  ].join('\n')

  console.log(lines)
}

bootstrap().catch((err: unknown) => {
  console.error('[bootstrap] failed:', err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
