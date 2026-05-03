import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger as PinoNestLogger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { AppConfigService } from './core/config/config.service'
import { APP_NAME, APP_VERSION } from './common/version'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(PinoNestLogger))

  app.setGlobalPrefix('v1')
  app.enableCors()
  app.enableShutdownHooks()

  const cfg = app.get(AppConfigService)
  await app.listen(cfg.port)

  const lines = [
    '════════════════════════════════════════',
    `  ${APP_NAME}@${APP_VERSION}`,
    `  NODE_ENV   ${cfg.nodeEnv}`,
    `  PORT       ${cfg.port}`,
    `  API        http://localhost:${cfg.port}/v1`,
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
