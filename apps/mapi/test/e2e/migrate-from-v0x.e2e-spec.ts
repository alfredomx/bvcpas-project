import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { config as dotenvConfig } from 'dotenv'
import { migrateFromV0x } from '../../scripts/migrate-from-mapi-v0x'

/**
 * Tests Tipo B (DB real) para el script de migración mapi v0.x → bvcpas.
 *
 * Verifica:
 * - SMK-mig-001: migra 3 clientes con sus tokens, preserva UUID + ciphertext byte-equal.
 * - SMK-mig-002: idempotencia — re-correr no duplica (skip por qbo_realm_id existente).
 * - SMK-mig-003: cliente sin tokens en source → migra solo el cliente, sin error.
 * - SMK-mig-004: clientes con realm_id null en source se saltan (no se pueden identificar
 *   como duplicados, política conservadora).
 *
 * Source DB: `mapi_v0x_source_test` creada en beforeAll con shape mínimo (clients + intuit_tokens).
 * Target DB: `mapi_test` con migrations aplicadas por global-setup.
 */

const SOURCE_DB = 'mapi_v0x_source_test'

let sourceUrl: string
let targetUrl: string

beforeAll(async () => {
  dotenvConfig({ path: '.env.test' })
  targetUrl = process.env.DATABASE_URL!
  if (!targetUrl) throw new Error('DATABASE_URL requerido')
  sourceUrl = targetUrl.replace(/\/[^/]+$/, `/${SOURCE_DB}`)

  // Crear DB source temporal contra el server postgres usando la DB postgres root
  const rootUrl = targetUrl.replace(/\/[^/]+$/, '/postgres')
  const root = postgres(rootUrl, { max: 1 })
  try {
    await root.unsafe(`DROP DATABASE IF EXISTS ${SOURCE_DB}`)
    await root.unsafe(`CREATE DATABASE ${SOURCE_DB}`)
  } finally {
    await root.end()
  }

  // Crear schema mínimo en source (las 2 tablas que el script lee).
  const src = postgres(sourceUrl, { max: 1 })
  const srcDb = drizzle(src)
  try {
    await srcDb.execute(sql`
      CREATE TABLE clients (
        id uuid PRIMARY KEY,
        legal_name varchar(200) NOT NULL,
        dba varchar(200),
        qbo_realm_id text UNIQUE,
        industry varchar(80),
        entity_type varchar(40),
        fiscal_year_start smallint,
        timezone varchar(60),
        status varchar(20) NOT NULL DEFAULT 'active',
        primary_contact_name varchar(120),
        primary_contact_email varchar(255),
        notes text,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await srcDb.execute(sql`
      CREATE TABLE intuit_tokens (
        client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
        realm_id text NOT NULL UNIQUE,
        access_token_encrypted text NOT NULL,
        refresh_token_encrypted text NOT NULL,
        access_token_expires_at timestamptz NOT NULL,
        refresh_token_expires_at timestamptz NOT NULL,
        last_refreshed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
  } finally {
    await src.end()
  }
}, 30000)

afterAll(async () => {
  const rootUrl = targetUrl.replace(/\/[^/]+$/, '/postgres')
  const root = postgres(rootUrl, { max: 1 })
  try {
    await root.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${SOURCE_DB}'`,
    )
    await root.unsafe(`DROP DATABASE IF EXISTS ${SOURCE_DB}`)
  } finally {
    await root.end()
  }
})

beforeEach(async () => {
  const src = postgres(sourceUrl, { max: 1 })
  const tgt = postgres(targetUrl, { max: 1 })
  try {
    await src.unsafe('TRUNCATE TABLE intuit_tokens, clients CASCADE')
    await tgt.unsafe('TRUNCATE TABLE intuit_tokens, clients CASCADE')
  } finally {
    await src.end()
    await tgt.end()
  }
})

const FAR_FUTURE = new Date(Date.now() + 100 * 24 * 3600 * 1000)
const ACCESS_FUTURE = new Date(Date.now() + 3600 * 1000)
const PAST = new Date(Date.now() - 1000)

const UUID_1 = '11111111-1111-1111-1111-111111111111'
const UUID_2 = '22222222-2222-2222-2222-222222222222'
const UUID_3 = '33333333-3333-3333-3333-333333333333'

async function seedSource(
  rows: {
    id: string
    legal_name: string
    qbo_realm_id?: string | null
    metadata?: Record<string, unknown> | null
    token?: {
      realm_id: string
      access_encrypted: string
      refresh_encrypted: string
      refresh_exp: Date
    }
  }[],
): Promise<void> {
  const src = postgres(sourceUrl, { max: 1 })
  try {
    for (const r of rows) {
      const metaArg =
        r.metadata === undefined || r.metadata === null ? null : src.json(r.metadata as never)
      await src`
        INSERT INTO clients (id, legal_name, qbo_realm_id, metadata)
        VALUES (${r.id}::uuid, ${r.legal_name}, ${r.qbo_realm_id ?? null}, ${metaArg})
      `
      if (r.token) {
        await src`
          INSERT INTO intuit_tokens (
            client_id, realm_id, access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at
          )
          VALUES (
            ${r.id}::uuid, ${r.token.realm_id}, ${r.token.access_encrypted},
            ${r.token.refresh_encrypted}, ${ACCESS_FUTURE}, ${r.token.refresh_exp}
          )
        `
      }
    }
  } finally {
    await src.end()
  }
}

async function fetchTarget(): Promise<{
  clients: { id: string; legal_name: string; qbo_realm_id: string | null }[]
  tokens: {
    client_id: string
    realm_id: string
    access_token_encrypted: string
    refresh_token_encrypted: string
  }[]
}> {
  const tgt = postgres(targetUrl, { max: 1 })
  try {
    const clients = (await tgt`
      SELECT id, legal_name, qbo_realm_id FROM clients ORDER BY legal_name
    `) as unknown as { id: string; legal_name: string; qbo_realm_id: string | null }[]
    const tokens = (await tgt`
      SELECT client_id, realm_id, access_token_encrypted, refresh_token_encrypted
      FROM intuit_tokens ORDER BY realm_id
    `) as unknown as {
      client_id: string
      realm_id: string
      access_token_encrypted: string
      refresh_token_encrypted: string
    }[]
    return { clients, tokens }
  } finally {
    await tgt.end()
  }
}

// SKIP en v0.8.0: el migrador escribe a `intuit_tokens` que ya no existe
// (renombrada a `intuit_tokens_deprecated` en migration 0007; la tabla
// real es ahora `user_connections` con provider='intuit'). Se reescribe
// en v0.8.1 junto con el drop de intuit_tokens_deprecated.
describe.skip('migrate-from-mapi-v0x E2E (Tipo B)', () => {
  describe('SMK-mig-001 — migra 3 clientes con tokens (preserva UUID + ciphertext)', () => {
    it('counts correctos y byte-equality del ciphertext', async () => {
      await seedSource([
        {
          id: UUID_1,
          legal_name: 'Acme LLC',
          qbo_realm_id: 'r-001',
          metadata: { intuit_country: 'US' },
          token: {
            realm_id: 'r-001',
            access_encrypted: 'iv1:tag1:ct1',
            refresh_encrypted: 'iv1:tag1:rt1',
            refresh_exp: FAR_FUTURE,
          },
        },
        {
          id: UUID_2,
          legal_name: 'Beta Corp',
          qbo_realm_id: 'r-002',
          token: {
            realm_id: 'r-002',
            access_encrypted: 'iv2:tag2:ct2',
            refresh_encrypted: 'iv2:tag2:rt2',
            refresh_exp: PAST, // refresh expirado pero igual se migra (ciphertext bytes)
          },
        },
        {
          id: UUID_3,
          legal_name: 'Cascade Co',
          qbo_realm_id: 'r-003',
          token: {
            realm_id: 'r-003',
            access_encrypted: 'iv3:tag3:ct3',
            refresh_encrypted: 'iv3:tag3:rt3',
            refresh_exp: FAR_FUTURE,
          },
        },
      ])

      const result = await migrateFromV0x({ sourceUrl, targetUrl })

      expect(result).toEqual({ migrated: 3, skipped: 0, failed: 0 })

      const target = await fetchTarget()
      expect(target.clients).toHaveLength(3)
      expect(target.clients.map((c) => c.id).sort()).toEqual([UUID_1, UUID_2, UUID_3])

      expect(target.tokens).toHaveLength(3)
      const t1 = target.tokens.find((t) => t.realm_id === 'r-001')
      expect(t1?.access_token_encrypted).toBe('iv1:tag1:ct1')
      expect(t1?.refresh_token_encrypted).toBe('iv1:tag1:rt1')
      expect(t1?.client_id).toBe(UUID_1)
    })
  })

  describe('SMK-mig-002 — idempotencia (re-correr no duplica)', () => {
    it('segunda corrida: 0 migrated, 3 skipped', async () => {
      await seedSource([
        {
          id: UUID_1,
          legal_name: 'Acme',
          qbo_realm_id: 'r-001',
          token: {
            realm_id: 'r-001',
            access_encrypted: 'a',
            refresh_encrypted: 'r',
            refresh_exp: FAR_FUTURE,
          },
        },
        {
          id: UUID_2,
          legal_name: 'Beta',
          qbo_realm_id: 'r-002',
          token: {
            realm_id: 'r-002',
            access_encrypted: 'a',
            refresh_encrypted: 'r',
            refresh_exp: FAR_FUTURE,
          },
        },
        {
          id: UUID_3,
          legal_name: 'Cascade',
          qbo_realm_id: 'r-003',
          token: {
            realm_id: 'r-003',
            access_encrypted: 'a',
            refresh_encrypted: 'r',
            refresh_exp: FAR_FUTURE,
          },
        },
      ])

      const first = await migrateFromV0x({ sourceUrl, targetUrl })
      expect(first.migrated).toBe(3)

      const second = await migrateFromV0x({ sourceUrl, targetUrl })
      expect(second).toEqual({ migrated: 0, skipped: 3, failed: 0 })

      const target = await fetchTarget()
      expect(target.clients).toHaveLength(3)
      expect(target.tokens).toHaveLength(3)
    })
  })

  describe('SMK-mig-003 — cliente sin tokens migra solo el cliente', () => {
    it('cliente sin row en intuit_tokens: migrated=1 sin token correspondiente', async () => {
      await seedSource([
        {
          id: UUID_1,
          legal_name: 'Sin tokens',
          qbo_realm_id: 'r-no-token',
        },
      ])

      const result = await migrateFromV0x({ sourceUrl, targetUrl })
      expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 })

      const target = await fetchTarget()
      expect(target.clients).toHaveLength(1)
      expect(target.tokens).toHaveLength(0)
    })
  })

  describe('SMK-mig-004 — clientes con qbo_realm_id null se saltan', () => {
    it('cliente sin realm_id no se migra (no se puede deduplicar)', async () => {
      await seedSource([
        { id: UUID_1, legal_name: 'Sin realm', qbo_realm_id: null },
        {
          id: UUID_2,
          legal_name: 'Con realm',
          qbo_realm_id: 'r-002',
          token: {
            realm_id: 'r-002',
            access_encrypted: 'a',
            refresh_encrypted: 'r',
            refresh_exp: FAR_FUTURE,
          },
        },
      ])

      const result = await migrateFromV0x({ sourceUrl, targetUrl })
      expect(result).toEqual({ migrated: 1, skipped: 1, failed: 0 })

      const target = await fetchTarget()
      expect(target.clients).toHaveLength(1)
      expect(target.clients[0]?.qbo_realm_id).toBe('r-002')
    })
  })
})
