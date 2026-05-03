import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Global setup para tests Tipo B (smoke con DB real).
 *
 * Levanta: aplica migrations sobre `mapi_test` (DB ya existente desde P0.2).
 *
 * Cada test e2e individual hace su propio seed/cleanup según necesite.
 * No se hace seed global aquí porque cada test necesita estado controlado.
 */
export default async function globalSetup(): Promise<void> {
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
    await migrate(db, { migrationsFolder: './drizzle/migrations' })
    console.log('[e2e-setup] Migrations OK.')
  } finally {
    await client.end()
  }
}
