import 'dotenv/config'
import postgres from 'postgres'

/**
 * Borra TODAS las filas de `bank_accounts` y `client_bank_accounts`.
 *
 * Usado antes de re-seedear desde cero. No toca `bank_portals` ni
 * `clients`.
 *
 * Por seguridad pide confirmación explícita vía env var
 * `BVCPAS_WIPE_CONFIRM=yes`. Si no está, falla.
 *
 * Ejecutar:
 *   BVCPAS_WIPE_CONFIRM=yes npx tsx scripts/wipe-bank-credentials.ts
 */

async function main(): Promise<void> {
  if (process.env.BVCPAS_WIPE_CONFIRM !== 'yes') {
    throw new Error(
      'Falta BVCPAS_WIPE_CONFIRM=yes. Este script es destructivo, requiere confirmación explícita.',
    )
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL es requerido')

  const sql = postgres(databaseUrl, { max: 1 })
  try {
    const before1 = await sql`SELECT COUNT(*)::int AS n FROM bank_accounts`
    const before2 = await sql`SELECT COUNT(*)::int AS n FROM client_bank_accounts`
    console.log(`[wipe] bank_accounts antes:        ${before1[0].n}`)
    console.log(`[wipe] client_bank_accounts antes: ${before2[0].n}`)

    await sql`TRUNCATE bank_accounts, client_bank_accounts RESTART IDENTITY CASCADE`

    const after1 = await sql`SELECT COUNT(*)::int AS n FROM bank_accounts`
    const after2 = await sql`SELECT COUNT(*)::int AS n FROM client_bank_accounts`
    console.log(`[wipe] bank_accounts después:        ${after1[0].n}`)
    console.log(`[wipe] client_bank_accounts después: ${after2[0].n}`)
  } finally {
    await sql.end()
  }
}

main().catch((err: unknown) => {
  console.error('[wipe] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
