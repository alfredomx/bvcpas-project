import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

/**
 * Concilia las credenciales bancarias entre el CSV original y la DB.
 *
 * Para cada cliente, cuenta:
 *  - csv_total: filas en `bank-credentials.original.csv`
 *  - db_total: filas en `client_bank_accounts` (vía join con `clients`)
 *  - diff: csv_total - db_total
 *
 * Reporta:
 *  - Totales globales (CSV vs DB).
 *  - Clientes con diff != 0 (descuadre).
 *  - Clientes en CSV que no están en DB (no resueltos).
 *
 * NO modifica nada. Solo lectura.
 *
 * Ejecutar: `npx tsx scripts/reconcile-bank-credentials.ts`
 */

const CREDS_PATH = resolve(__dirname, '..', 'seeds-tmp', 'bank-credentials.original.csv')
const MAPPING_PATH = resolve(__dirname, '..', 'seeds-tmp', 'client-mapping.csv')

/**
 * Igual al normalizer del seeder: quita LLC/Inc/Corp/L.L.C./puntuación
 * y colapsa espacios para matching robusto entre CSV y DB.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bl\.l\.c\.?\b/g, 'llc')
    .replace(/\bllc\.?\b/g, '')
    .replace(/\binc\.?\b/g, '')
    .replace(/\bltd\.?\b/g, '')
    .replace(/\bcorp\.?\b/g, '')
    .replace(/\blimited liability company\b/g, '')
    .replace(/\(dba\)/g, '')
    .replace(/[,.()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\r') {
        // skip CR (Windows line endings)
      } else if (c === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 1)
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL es requerido')

  // CSV totals por nombre crudo del CSV
  const credText = readFileSync(CREDS_PATH, 'utf8').replace(/^\uFEFF/, '')
  const credRows = parseCsv(credText)
  const credHeader = credRows[0]
  const idxClient = credHeader.indexOf('Client')
  const csvCounts = new Map<string, number>()
  for (const r of credRows.slice(1)) {
    const name = (r[idxClient] || '').trim()
    if (!name) continue
    csvCounts.set(name, (csvCounts.get(name) ?? 0) + 1)
  }

  // Mapping
  const mapText = readFileSync(MAPPING_PATH, 'utf8').replace(/^\uFEFF/, '')
  const mapRows = parseCsv(mapText)
  const mh = mapRows[0]
  const ci = mh.indexOf('csv_name')
  const di = mh.indexOf('db_match')
  const mapping = new Map<string, string>()
  for (const r of mapRows.slice(1)) mapping.set(r[ci], r[di])

  const sql = postgres(databaseUrl, { max: 1 })
  try {
    const clients = await sql<
      { id: string; legal_name: string }[]
    >`SELECT id, legal_name FROM clients`
    const clientByName = new Map<string, string>()
    const clientByNormalized = new Map<string, string>()
    for (const c of clients) {
      clientByName.set(c.legal_name.toLowerCase().trim(), c.id)
      clientByNormalized.set(normalizeName(c.legal_name), c.id)
    }

    function resolveClientId(csvName: string): string | null {
      const direct = clientByName.get(csvName.toLowerCase().trim())
      if (direct) return direct
      const mapped = mapping.get(csvName)
      if (mapped) {
        const ml = mapped.toLowerCase().trim()
        if (ml !== 'alta manual' && ml !== 'ya lo di de alta') {
          const via = clientByName.get(ml)
          if (via) return via
          const viaNorm = clientByNormalized.get(normalizeName(mapped))
          if (viaNorm) return viaNorm
        }
      }
      const normHit = clientByNormalized.get(normalizeName(csvName))
      if (normHit) return normHit
      return null
    }

    // CSV → expected counts por client_id resuelto
    const expectedByClientId = new Map<string, number>()
    const unresolvedCsvNames: string[] = []
    let csvTotal = 0
    for (const [csvName, count] of csvCounts) {
      csvTotal += count
      const cid = resolveClientId(csvName)
      if (!cid) {
        unresolvedCsvNames.push(`${csvName} (${count} filas)`)
        continue
      }
      expectedByClientId.set(cid, (expectedByClientId.get(cid) ?? 0) + count)
    }

    // DB totals por client_id
    const dbCounts = await sql<{ client_id: string; n: number }[]>`
      SELECT client_id, COUNT(*)::int AS n
      FROM client_bank_accounts
      GROUP BY client_id
    `
    const dbByClientId = new Map<string, number>()
    for (const r of dbCounts) dbByClientId.set(r.client_id, r.n)
    const dbTotal = dbCounts.reduce((acc, r) => acc + r.n, 0)

    // Reporte
    console.log('═'.repeat(80))
    console.log(`CSV total filas:                ${csvTotal}`)
    console.log(
      `CSV resueltas a algún cliente:  ${csvTotal - unresolvedCsvNames.reduce((acc, x) => acc + Number(/\((\d+) filas/.exec(x)?.[1] ?? 0), 0)}`,
    )
    console.log(`DB total client_bank_accounts:  ${dbTotal}`)
    console.log('═'.repeat(80))

    // Descuadres
    const allClientIds = new Set([...expectedByClientId.keys(), ...dbByClientId.keys()])
    const mismatches: { legalName: string; csv: number; db: number; diff: number }[] = []
    for (const cid of allClientIds) {
      const csv = expectedByClientId.get(cid) ?? 0
      const db = dbByClientId.get(cid) ?? 0
      const diff = csv - db
      if (diff !== 0) {
        const cli = clients.find((c) => c.id === cid)
        mismatches.push({
          legalName: cli?.legal_name ?? `(missing client ${cid})`,
          csv,
          db,
          diff,
        })
      }
    }
    if (mismatches.length === 0) {
      console.log('✅ Cuadre por cliente: PERFECTO')
    } else {
      console.log(`⚠ Descuadre en ${mismatches.length} clientes:`)
      mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      for (const m of mismatches) {
        console.log(`   ${m.diff > 0 ? '+' : ''}${m.diff}  csv=${m.csv} db=${m.db}  ${m.legalName}`)
      }
    }
    console.log('═'.repeat(80))

    if (unresolvedCsvNames.length) {
      console.log(`⚠ Nombres del CSV no resueltos a cliente (${unresolvedCsvNames.length}):`)
      for (const x of unresolvedCsvNames) console.log(`   - ${x}`)
      console.log('═'.repeat(80))
    }
  } finally {
    await sql.end()
  }
}

main().catch((err: unknown) => {
  console.error('[reconcile] failed:', err instanceof Error ? err.stack : err)
  process.exit(1)
})
