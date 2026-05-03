import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations')
  }

  console.log('[migrate] connecting to database...')
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)

  const start = Date.now()
  console.log('[migrate] applying pending migrations...')
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
  console.log(`[migrate] done in ${Date.now() - start}ms`)

  await client.end()
}

main().catch((err: unknown) => {
  console.error('[migrate] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
