import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL es requerido para drizzle-kit (revisa .env)')
}

export default defineConfig({
  dialect: 'postgresql',
  // Core + tablas de plugins (cada plugin es dueño de su `*.schema.ts`).
  // Un solo historial de migraciones para un solo Postgres (D-intuit-005).
  schema: ['./core/src/core/db/schema/index.ts', './plugins/*/src/**/*.schema.ts'],
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
