import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { config as dotenvConfig } from 'dotenv'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { AppModule } from '../../src/app.module'

/**
 * Helper para tests E2E (Tipo B): levanta una INestApplication apuntando
 * a `mapi_test` (DB de tests).
 *
 * Cada test debe llamar `setupTestApp()` en `beforeAll` y `app.close()`
 * en `afterAll`. Para limpiar tablas entre tests, usar `truncateTables()`.
 *
 * Carga `.env.test` antes de bootstrap.
 */

let envLoaded = false

function ensureEnvLoaded(): void {
  if (envLoaded) return
  dotenvConfig({ path: '.env.test' })
  envLoaded = true
}

export async function setupTestApp(): Promise<INestApplication> {
  ensureEnvLoaded()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  app.setGlobalPrefix('v1', { exclude: ['metrics'] })
  // Sin pipes de validación adicionales — los DTOs Zod ya validan en el
  // controller. Si necesitas pipe custom para algún test, agregar aquí.
  void ValidationPipe

  await app.init()
  return app
}

/**
 * Limpia todas las tablas (DELETE rows) sin re-correr migrations.
 * Útil entre tests dentro de un mismo describe para estado fresco.
 */
export async function truncateTables(): Promise<void> {
  ensureEnvLoaded()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL requerido')
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)
  try {
    await db.execute(
      sql`TRUNCATE TABLE client_public_links, client_period_followups, client_transaction_responses, client_transactions, intuit_tokens_deprecated, user_client_access, user_connections, clients, user_sessions, event_log, users RESTART IDENTITY CASCADE`,
    )
  } finally {
    await client.end()
  }
}
