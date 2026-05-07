import { config as dotenvConfig } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'

/**
 * Global setup para tests Tipo B (smoke con DB real).
 *
 * Levanta: aplica migrations sobre `mapi_test` (DB ya existente desde P0.2).
 *
 * Cada test e2e individual hace su propio seed/cleanup según necesite.
 * No se hace seed global aquí porque cada test necesita estado controlado.
 *
 * Carga `.env.test` (no `.env`) — variables específicas de tests.
 */
export default async function globalSetup(): Promise<void> {
  // Carga `.env.test` antes que `.env` para no contaminar tests con DB local.
  dotenvConfig({ path: '.env.test' })

  const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_TEST o DATABASE_URL requerido para tests E2E')
  }
  if (!databaseUrl.includes('mapi_test')) {
    throw new Error(
      `[e2e-setup] DATABASE_URL no apunta a mapi_test. Refusing to run migrations en DB no-test. URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`,
    )
  }

  console.log('[e2e-setup] Aplicando migrations sobre mapi_test...')
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)

  try {
    // Drop completo de tablas + drizzle metadata antes de aplicar migrations.
    // Garantiza estado limpio entre runs (importante: mapi_test es compartida).
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS client_public_links CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS client_period_followups CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS client_transaction_responses CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS client_transactions CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS intuit_tokens CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS intuit_tokens_deprecated CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS user_microsoft_tokens CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS user_client_access CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS user_connections CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS clients CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS user_sessions CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS event_log CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`)
    await db.execute(sql`DROP FUNCTION IF EXISTS users_set_updated_at CASCADE`)
    await db.execute(sql`DROP FUNCTION IF EXISTS clients_set_updated_at CASCADE`)
    await db.execute(sql`DROP FUNCTION IF EXISTS intuit_tokens_set_updated_at CASCADE`)
    await db.execute(
      sql`DROP FUNCTION IF EXISTS client_transaction_responses_set_updated_at CASCADE`,
    )
    await db.execute(sql`DROP FUNCTION IF EXISTS client_period_followups_set_updated_at CASCADE`)

    await migrate(db, { migrationsFolder: './drizzle/migrations' })
    console.log('[e2e-setup] Migrations OK.')
  } finally {
    await client.end()
  }
}
