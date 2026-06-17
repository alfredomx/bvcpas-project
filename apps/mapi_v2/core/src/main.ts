import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { Logger as PinoNestLogger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { AppConfigService } from '@/core/config/config.service'
import { DomainErrorFilter } from '@/common/errors/domain-error.filter'
import { REGISTRY, assertRegistryConfig } from '@/registry/registry'
import { APP_NAME, APP_VERSION } from './common/version'

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
  // Fail-fast: valida la config (Zod) de cada unit del registro contra el env
  // antes de levantar Nest. Si falta una var, muere aquí con error claro.
  assertRegistryConfig(REGISTRY, process.env)

  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(PinoNestLogger))

  app.setGlobalPrefix('v1')
  app.enableCors()
  app.useGlobalFilters(new DomainErrorFilter())
  app.enableShutdownHooks()

  const cfg = app.get(AppConfigService)
  await app.listen(cfg.port)

  const lines = [
    '════════════════════════════════════════',
    `  ${APP_NAME}@${APP_VERSION}`,
    `  NODE_ENV   ${cfg.nodeEnv}`,
    `  PORT       ${cfg.port}`,
    `  Health     http://localhost:${cfg.port}/v1/healthz`,
    `  Units      ${REGISTRY.length} (${REGISTRY.map((u) => u.name).join(', ') || 'core booteable solo'})`,
    '════════════════════════════════════════',
  ].join('\n')

  console.log(lines)
}

bootstrap().catch((err: unknown) => {
  console.error('[bootstrap] failed:', err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
