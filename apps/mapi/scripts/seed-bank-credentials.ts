import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql as drizzleSql } from 'drizzle-orm'
import postgres from 'postgres'
import { clients } from '../src/db/schema/clients'
import { bankPortals } from '../src/db/schema/bank-portals'
import { clientBankAccounts } from '../src/db/schema/client-bank-accounts'
import { EncryptionService } from '../src/core/encryption/encryption.service'

/**
 * Seed de credenciales bancarias desde `seeds-tmp/bank-credentials.original.csv`.
 *
 * CSV columns (con header):
 *   Client, Account, Status, Portal, User, Password, Security Question / Code, Notes
 *
 * Resolución de cliente:
 *   1. Match directo en `clients.legal_name` (case-insensitive, trimmed).
 *   2. Si no, consulta `seeds-tmp/client-mapping.csv`. Si `db_match` es un
 *      `legal_name` real, usa ese. Si es "alta manual"/"ya lo di de alta",
 *      asume que el `csv_name` ya está en DB.
 *   3. Normalización suplementaria: agrega coma/punto/sufijo común.
 *   4. Si nada → reporta y skip.
 *
 * Resolución de portal: match exact (case-insensitive, trimmed) contra
 * `bank_portals.name`. Si no existe, reporta y skip.
 *
 * Credenciales:
 *   - Si user o password vacíos/"-", se inserta NULL (caso real: cliente
 *     todavía no entregó credenciales). v0.16.1 permite NULL.
 *   - Si tiene security_qa, se encripta.
 *   - Nickname: por defecto vacío. Para distinguir credenciales múltiples
 *     en el mismo (cliente, portal), agregamos sufijo `#N` cuando hay
 *     más de una en el CSV. v0.16.4 removió UNIQUE(client_id, portal_id).
 *
 * NO es idempotente. Asume tabla vacía (truncar antes con
 * `npx tsx scripts/wipe-bank-credentials.ts`).
 *
 * Ejecutar: `npx tsx scripts/seed-bank-credentials.ts`
 */

const CREDS_PATH = resolve(__dirname, '..', 'seeds-tmp', 'bank-credentials.original.csv')
const MAPPING_PATH = resolve(__dirname, '..', 'seeds-tmp', 'client-mapping.csv')

interface CredRow {
  client: string
  account: string
  status: string
  portal: string
  user: string
  password: string
  securityQa: string
  notes: string
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
        // skip
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

function loadCredentials(): CredRow[] {
  const text = readFileSync(CREDS_PATH, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  const h = rows[0]
  const ix = {
    client: h.indexOf('Client'),
    account: h.indexOf('Account'),
    status: h.indexOf('Status'),
    portal: h.indexOf('Portal'),
    user: h.indexOf('User'),
    password: h.indexOf('Password'),
    securityQa: h.indexOf('Security Question / Code'),
    notes: h.indexOf('Notes'),
  }
  return rows.slice(1).map((r) => ({
    client: (r[ix.client] || '').trim(),
    account: (r[ix.account] || '').trim(),
    status: (r[ix.status] || '').trim(),
    portal: (r[ix.portal] || '').trim(),
    user: (r[ix.user] || '').trim(),
    password: (r[ix.password] || '').trim(),
    securityQa: (r[ix.securityQa] || '').trim(),
    notes: (r[ix.notes] || '').trim(),
  }))
}

function loadMapping(): Map<string, string> {
  const text = readFileSync(MAPPING_PATH, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  const h = rows[0]
  const ci = h.indexOf('csv_name')
  const di = h.indexOf('db_match')
  const map = new Map<string, string>()
  for (const r of rows.slice(1)) map.set(r[ci], r[di])
  return map
}

/**
 * Normalización agresiva para matching de nombres de cliente entre CSV y DB.
 *
 * - lowercase
 * - quita acentos
 * - quita sufijos legales (LLC, Inc, L.L.C., Ltd, Corp, Limited Liability Company)
 * - quita comas, puntos, paréntesis
 * - colapsa espacios
 *
 * Ejemplos:
 *   "Arcmen Engineering Electrical Contractors LLC."
 *   → "arcmen engineering electrical contractors"
 *   "Arcmen Engineering Electrical Contractors, LLC"
 *   → "arcmen engineering electrical contractors"
 *   (match)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos
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

function normalizeStatus(s: string): 'active' | 'blocked' | 'closed' {
  const v = s.toLowerCase().trim()
  if (v === 'active') return 'active'
  if (v === 'closed') return 'closed'
  // "Wrong Pass" y otros → blocked
  return 'blocked'
}

function cleanValue(v: string): string | null {
  if (!v) return null
  const t = v.trim()
  if (!t || t === '-') return null
  return t
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!databaseUrl) throw new Error('DATABASE_URL es requerido')
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY es requerido')

  const encryption = new EncryptionService(encryptionKey)

  const credRows = loadCredentials()
  const mapping = loadMapping()
  console.log(`[seed-creds] CSV: ${credRows.length} filas`)
  console.log(`[seed-creds] mapping: ${mapping.size} entradas`)

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client, { schema: { clients, bankPortals, clientBankAccounts } })

  try {
    // Cargar diccionarios
    const allClients = await db.select().from(clients)
    const clientByName = new Map<string, string>()
    const clientByNormalized = new Map<string, string>()
    for (const c of allClients) {
      clientByName.set(c.legalName.toLowerCase().trim(), c.id)
      clientByNormalized.set(normalizeName(c.legalName), c.id)
    }
    console.log(`[seed-creds] DB tiene ${allClients.length} clientes`)

    const allPortals = await db.select().from(bankPortals)
    const portalByName = new Map<string, string>()
    for (const p of allPortals) portalByName.set(p.name.toLowerCase().trim(), p.id)
    console.log(`[seed-creds] DB tiene ${allPortals.length} portales`)

    // Resolver clientId con cascada
    function resolveClientId(csvName: string): string | null {
      const lower = csvName.toLowerCase().trim()
      const direct = clientByName.get(lower)
      if (direct) return direct

      // Buscar en mapping
      const mapped = mapping.get(csvName)
      if (mapped) {
        const mappedLower = mapped.toLowerCase().trim()
        if (mappedLower !== 'alta manual' && mappedLower !== 'ya lo di de alta') {
          const via = clientByName.get(mappedLower)
          if (via) return via
          const viaNorm = clientByNormalized.get(normalizeName(mapped))
          if (viaNorm) return viaNorm
        }
      }

      // Normalización agresiva: quita LLC/Inc/L.L.C./puntuación y compara
      const normHit = clientByNormalized.get(normalizeName(csvName))
      if (normHit) return normHit

      return null
    }

    function resolvePortalId(csvPortal: string): string | null {
      return portalByName.get(csvPortal.toLowerCase().trim()) ?? null
    }

    // Para nickname: detectar credenciales múltiples del mismo (client, portal)
    const groupCount = new Map<string, number>()
    const groupSeen = new Map<string, number>()
    for (const r of credRows) {
      const cid = resolveClientId(r.client)
      const pid = resolvePortalId(r.portal)
      if (!cid || !pid) continue
      const key = `${cid}|${pid}`
      groupCount.set(key, (groupCount.get(key) ?? 0) + 1)
    }

    let inserted = 0
    const missingClient: string[] = []
    const missingPortal: string[] = []
    let withFullCreds = 0
    let withPartialCreds = 0

    for (const r of credRows) {
      const cid = resolveClientId(r.client)
      if (!cid) {
        missingClient.push(r.client)
        continue
      }
      const pid = resolvePortalId(r.portal)
      if (!pid) {
        missingPortal.push(`${r.client} → ${r.portal}`)
        continue
      }

      const user = cleanValue(r.user)
      const pass = cleanValue(r.password)
      const sec = cleanValue(r.securityQa)
      const notes = cleanValue(r.notes)
      if (user && pass) withFullCreds++
      else withPartialCreds++

      // Nickname: si hay más de uno en el grupo, agregar `#N` (1-indexed)
      const key = `${cid}|${pid}`
      const total = groupCount.get(key) ?? 1
      const seq = (groupSeen.get(key) ?? 0) + 1
      groupSeen.set(key, seq)
      const nickname = total > 1 ? `#${seq}` : null

      await db.insert(clientBankAccounts).values({
        clientId: cid,
        bankPortalId: pid,
        nickname,
        usernameEncrypted: user ? encryption.encrypt(user) : null,
        passwordEncrypted: pass ? encryption.encrypt(pass) : null,
        securityQaEncrypted: sec ? encryption.encrypt(sec) : null,
        status: normalizeStatus(r.status),
        notes,
      })
      inserted++
    }

    console.log(`[seed-creds] Insertadas: ${inserted}`)
    console.log(`[seed-creds]   con credenciales completas: ${withFullCreds}`)
    console.log(`[seed-creds]   con credenciales parciales: ${withPartialCreds}`)
    if (missingClient.length) {
      console.log(`[seed-creds] CLIENTES NO RESUELTOS (${missingClient.length}):`)
      for (const x of new Set(missingClient)) console.log(`   - ${x}`)
    }
    if (missingPortal.length) {
      console.log(`[seed-creds] PORTALES NO RESUELTOS (${missingPortal.length}):`)
      for (const x of new Set(missingPortal)) console.log(`   - ${x}`)
    }

    const dbTotal = await db
      .select({ n: drizzleSql<number>`COUNT(*)::int` })
      .from(clientBankAccounts)
    console.log(`[seed-creds] Total en DB ahora: ${dbTotal[0].n}`)
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error('[seed-creds] failed:', err instanceof Error ? err.stack : err)
  process.exit(1)
})
