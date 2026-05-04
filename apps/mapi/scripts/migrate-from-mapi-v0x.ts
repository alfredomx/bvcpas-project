import postgres, { type Sql } from 'postgres'

/**
 * Script de migración mapi v0.x → bvcpas-project.
 *
 * Lee `clients` y `intuit_tokens` desde `MAPI_V0X_DATABASE_URL` (source) y los
 * INSERT-ea en `DATABASE_URL` (target = bvcpas-project) preservando UUIDs y
 * timestamps. El ciphertext de los tokens (`*_encrypted`) se copia byte-equal
 * sin tocarlo: ambas bases comparten `ENCRYPTION_KEY`, así que no hay que
 * descifrar/recifrar.
 *
 * **Idempotencia**: si un `qbo_realm_id` ya existe en el target, se skipea.
 * Si re-corres, los counts indicarán 0 migrated / N skipped.
 *
 * **Política conservadora**: clientes con `qbo_realm_id IS NULL` en source
 * se skipean — no hay forma natural de deduplicar y la operación de mapi
 * v0.x sin realm es marginal (cliente creado sin OAuth).
 *
 * **Tokens**: si el cliente tiene fila en source.`intuit_tokens`, también se
 * migra. Si no, solo el cliente. Refresh expirado igual se copia (el operador
 * decide si re-autoriza después).
 *
 * Uso vía `npm run db:migrate-from-v0x` o programáticamente desde tests.
 */

interface SourceClientRow {
  id: string
  legal_name: string
  dba: string | null
  qbo_realm_id: string | null
  industry: string | null
  entity_type: string | null
  fiscal_year_start: number | null
  timezone: string | null
  status: string
  primary_contact_name: string | null
  primary_contact_email: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

interface SourceTokenRow {
  client_id: string
  realm_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  access_token_expires_at: Date
  refresh_token_expires_at: Date
  last_refreshed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface MigrateOptions {
  sourceUrl: string
  targetUrl: string
}

export interface MigrateReport {
  migrated: number
  skipped: number
  failed: number
}

export async function migrateFromV0x(opts: MigrateOptions): Promise<MigrateReport> {
  const src: Sql = postgres(opts.sourceUrl, { max: 2 })
  const tgt: Sql = postgres(opts.targetUrl, { max: 2 })

  const report: MigrateReport = { migrated: 0, skipped: 0, failed: 0 }

  try {
    const clients = (await src`
      SELECT id, legal_name, dba, qbo_realm_id, industry, entity_type,
             fiscal_year_start, timezone, status, primary_contact_name,
             primary_contact_email, notes, metadata, created_at, updated_at
      FROM clients
      ORDER BY created_at
    `) as unknown as SourceClientRow[]

    const tokens = (await src`
      SELECT client_id, realm_id, access_token_encrypted, refresh_token_encrypted,
             access_token_expires_at, refresh_token_expires_at, last_refreshed_at,
             created_at, updated_at
      FROM intuit_tokens
    `) as unknown as SourceTokenRow[]

    const tokensByClientId = new Map<string, SourceTokenRow>()
    for (const t of tokens) tokensByClientId.set(t.client_id, t)

    for (const c of clients) {
      // Política: sin realm_id no migramos (no se puede deduplicar).
      if (!c.qbo_realm_id) {
        report.skipped++
        continue
      }

      // Idempotencia: skip si ya existe en target.
      const existing = (await tgt`
        SELECT id FROM clients WHERE qbo_realm_id = ${c.qbo_realm_id} LIMIT 1
      `) as unknown as { id: string }[]
      if (existing.length > 0) {
        report.skipped++
        continue
      }

      try {
        await tgt.begin(async (txn) => {
          const metaArg = c.metadata === null ? null : txn.json(c.metadata as never)
          await txn`
            INSERT INTO clients (
              id, legal_name, dba, qbo_realm_id, industry, entity_type,
              fiscal_year_start, timezone, status, primary_contact_name,
              primary_contact_email, notes, metadata, created_at, updated_at
            )
            VALUES (
              ${c.id}::uuid, ${c.legal_name}, ${c.dba}, ${c.qbo_realm_id},
              ${c.industry}, ${c.entity_type}, ${c.fiscal_year_start},
              ${c.timezone}, ${c.status}, ${c.primary_contact_name},
              ${c.primary_contact_email}, ${c.notes}, ${metaArg},
              ${c.created_at}, ${c.updated_at}
            )
          `

          const tok = tokensByClientId.get(c.id)
          if (tok) {
            await txn`
              INSERT INTO intuit_tokens (
                client_id, realm_id, access_token_encrypted, refresh_token_encrypted,
                access_token_expires_at, refresh_token_expires_at, last_refreshed_at,
                created_at, updated_at
              )
              VALUES (
                ${tok.client_id}::uuid, ${tok.realm_id},
                ${tok.access_token_encrypted}, ${tok.refresh_token_encrypted},
                ${tok.access_token_expires_at}, ${tok.refresh_token_expires_at},
                ${tok.last_refreshed_at}, ${tok.created_at}, ${tok.updated_at}
              )
            `
          }
        })
        report.migrated++
      } catch (err) {
        report.failed++
        console.error(
          `[migrate-from-v0x] Failed to migrate client ${c.id} (realm ${c.qbo_realm_id}):`,
          err instanceof Error ? err.message : err,
        )
      }
    }

    return report
  } finally {
    await src.end()
    await tgt.end()
  }
}

// Entry point cuando se ejecuta directo con tsx (no en tests).
const isMainModule = process.argv[1]?.endsWith('migrate-from-mapi-v0x.ts')
if (isMainModule) {
  const sourceUrl = process.env.MAPI_V0X_DATABASE_URL
  const targetUrl = process.env.DATABASE_URL
  if (!sourceUrl) {
    console.error('MAPI_V0X_DATABASE_URL requerido (apuntar al postgres source de mapi v0.x)')
    process.exit(1)
  }
  if (!targetUrl) {
    console.error('DATABASE_URL requerido (target = bvcpas-project)')
    process.exit(1)
  }

  migrateFromV0x({ sourceUrl, targetUrl })
    .then((report) => {
      console.log('[migrate-from-v0x] Resultado:', report)
      process.exit(report.failed > 0 ? 1 : 0)
    })
    .catch((err: unknown) => {
      console.error('[migrate-from-v0x] Error fatal:', err)
      process.exit(1)
    })
}
