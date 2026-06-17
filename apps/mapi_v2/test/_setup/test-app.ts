import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { config as dotenvConfig } from 'dotenv'
import { AppModule } from '@/app.module'
import { DomainErrorFilter } from '@/common/errors/domain-error.filter'

/**
 * Helper para tests E2E (Tipo B): levanta una INestApplication del core con
 * la misma configuración que `main.ts` (prefijo `/v1`, DomainErrorFilter).
 *
 * Cada test llama `setupTestApp()` en `beforeAll` y `app.close()` en
 * `afterAll`. Carga `.env` (config local) antes del bootstrap; las
 * conexiones a db/redis son lazy, así que la app levanta sin infra viva
 * mientras el test no toque rutas que la usen.
 */
let envLoaded = false

function ensureEnvLoaded(): void {
  if (envLoaded) return
  dotenvConfig()
  envLoaded = true
}

export async function setupTestApp(): Promise<INestApplication> {
  ensureEnvLoaded()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new DomainErrorFilter())

  await app.init()
  return app
}
