import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { bankPortals } from '../src/db/schema/bank-portals'

/**
 * Seed de portales bancarios desde `seeds-tmp/bank-portals.csv`.
 *
 * Formato CSV (sin header): `name,portal_url`. URL puede ser vacía.
 *
 * Idempotente: hace upsert por `name`. Si el portal ya existe, actualiza
 * la URL. Si no existe, inserta. Nunca borra.
 *
 * Ejecutar: `npx tsx scripts/seed-bank-portals.ts`
 */

const CSV_PATH = resolve(__dirname, '..', 'seeds-tmp', 'bank-portals.csv')

interface PortalRow {
  name: string
  url: string | null
}

function parseCsv(text: string): PortalRow[] {
  const rows: PortalRow[] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const idx = line.indexOf(',')
    if (idx < 0) {
      rows.push({ name: line.trim(), url: null })
      continue
    }
    const name = line.slice(0, idx).trim()
    const url = line.slice(idx + 1).trim()
    rows.push({ name, url: url || null })
  }
  return rows
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL es requerido')

  const text = readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)

  console.log(`[seed-portals] CSV: ${rows.length} portales`)

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client, { schema: { bankPortals } })

  let inserted = 0
  let updated = 0
  let skipped = 0
  try {
    for (const r of rows) {
      if (!r.name) {
        skipped++
        continue
      }
      const existing = await db
        .select()
        .from(bankPortals)
        .where(eq(bankPortals.name, r.name))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(bankPortals).values({ name: r.name, portalUrl: r.url })
        inserted++
      } else {
        const current = existing[0]
        if (current.portalUrl !== r.url) {
          await db
            .update(bankPortals)
            .set({ portalUrl: r.url, updatedAt: new Date() })
            .where(eq(bankPortals.id, current.id))
          updated++
        }
      }
    }
  } finally {
    await client.end()
  }

  console.log(`[seed-portals] done. inserted=${inserted} updated=${updated} skipped=${skipped}`)
}

main().catch((err: unknown) => {
  console.error('[seed-portals] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
