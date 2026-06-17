import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { Logger as PinoNestLogger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { APP_NAME, APP_VERSION } from './common/version'

/**
 * Bootstrap del CORE (host de plugins). Reducido a propósito en este corte:
 * - Pino como logger.
 * - Prefijo global `/v1`.
 * - Shutdown hooks (para cuando entren db/queue y haya que cerrar pools).
 *
 * El plugin-loader, Scalar, bull-board y el WS adapter se agregan cuando
 * el core/plugins que los necesitan entren en sus propios commits.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(PinoNestLogger))

  app.setGlobalPrefix('v1')
  app.enableCors()
  app.enableShutdownHooks()

  const port = Number(process.env.PORT ?? 4200)
  await app.listen(port)

  const lines = [
    '════════════════════════════════════════',
    `  ${APP_NAME}@${APP_VERSION}`,
    `  NODE_ENV   ${process.env.NODE_ENV ?? 'local'}`,
    `  PORT       ${port}`,
    `  Health     http://localhost:${port}/v1/healthz`,
    `  Plugins    0 (core booteable solo)`,
    '════════════════════════════════════════',
  ].join('\n')

  console.log(lines)
}

bootstrap().catch((err: unknown) => {
  console.error('[bootstrap] failed:', err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
