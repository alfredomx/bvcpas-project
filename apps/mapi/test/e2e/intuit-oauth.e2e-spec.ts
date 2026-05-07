import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (smoke con DB real) para Intuit en v0.8.0.
 *
 * Cobertura:
 * - SMK-intuit-001: GET /v1/intuit/oauth/tokens responde 200 con lista
 *   vacía y 200 con items cuando hay conexiones en user_connections.
 * - SMK-intuit-002: GET /v1/intuit/oauth/tokens NO incluye access_token
 *   ni refresh_token plaintext (solo metadata).
 * - SMK-intuit-003: DELETE /v1/clients/:id/intuit/connection borra y
 *   emite evento. El cliente sigue intacto.
 * - SMK-intuit-004: cascade delete clients → user_connections (provider='intuit')
 *   al borrar cliente.
 *
 * El flow OAuth completo (callback con SDK Intuit) se cubre en tests
 * unitarios; aquí solo verificamos cableado HTTP + persistencia.
 */

const ADMIN_EMAIL = 'admin-intuit@example.com'
const ADMIN_PASSWORD = 'admin-intuit-pwd-12345'

interface LoginResponseShape {
  accessToken: string
}

interface TokensListShape {
  items: {
    client_id: string
    realm_id: string
    access_token_expires_at: string
    refresh_token_expires_at: string
    last_refreshed_at: string | null
    days_until_refresh_expiry: number
  }[]
}

describe('Intuit OAuth E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let adminUserId: string

  beforeAll(async () => {
    app = await setupTestApp()
    await truncateTables()

    const { hash } = await import('bcrypt')
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL requerido')
    const c = postgres(databaseUrl, { max: 1 })
    try {
      const hashed = await hash(ADMIN_PASSWORD, 4)
      const [admin] = (await c`
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin Intuit', 'admin', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      adminUserId = admin.id
    } finally {
      await c.end()
    }

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200)
    adminToken = (loginRes.body as LoginResponseShape).accessToken
  }, 30000)

  afterAll(async () => {
    await app.close()
  })

  describe('SMK-intuit-001 — GET /v1/intuit/oauth/tokens', () => {
    it('lista vacía cuando no hay conexiones intuit', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/intuit/oauth/tokens')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect((res.body as TokensListShape).items).toEqual([])
    })

    it('retorna items con metadata cuando existen conexiones en user_connections', async () => {
      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      let clientId: string
      try {
        const [client] = (await c`
          INSERT INTO clients (legal_name, qbo_realm_id, status)
          VALUES ('Acme Corp', 'realm-001', 'active')
          RETURNING id
        `) as unknown as { id: string }[]
        clientId = client.id

        const future = new Date(Date.now() + 100 * 24 * 3600 * 1000)
        const accessFuture = new Date(Date.now() + 3600 * 1000)
        await c`
          INSERT INTO user_connections (
            user_id, provider, external_account_id, client_id, scope_type,
            scopes, access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at
          )
          VALUES (
            ${adminUserId}, 'intuit', 'realm-001', ${clientId}, 'full',
            'com.intuit.quickbooks.accounting openid', 'enc-access', 'enc-refresh',
            ${accessFuture}, ${future}
          )
        `
      } finally {
        await c.end()
      }

      const res = await request(app.getHttpServer())
        .get('/v1/intuit/oauth/tokens')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as TokensListShape
      expect(body.items).toHaveLength(1)
      expect(body.items[0]?.realm_id).toBe('realm-001')
      expect(body.items[0]?.client_id).toBe(clientId)
      expect(body.items[0]?.days_until_refresh_expiry).toBeGreaterThan(95)
    })
  })

  describe('SMK-intuit-002 — listado NO incluye plaintext ni ciphertext de tokens', () => {
    it('items solo tienen metadata, no valores de tokens', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/intuit/oauth/tokens')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const stringified = JSON.stringify(res.body)
      expect(stringified).not.toContain('enc-access')
      expect(stringified).not.toContain('enc-refresh')
      expect(stringified).not.toContain('access_token_encrypted')
      expect(stringified).not.toContain('refresh_token_encrypted')
    })
  })

  describe('SMK-intuit-003 — DELETE /v1/clients/:id/intuit/connection', () => {
    it('borra TODAS las conexiones Intuit del cliente y deja al cliente intacto', async () => {
      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      let clientId: string
      try {
        const [client] = (await c`
          INSERT INTO clients (legal_name, qbo_realm_id, status)
          VALUES ('Beta Inc', 'realm-002', 'active')
          RETURNING id
        `) as unknown as { id: string }[]
        clientId = client.id

        // user_client_access para que el guard deje pasar al admin user
        await c`
          INSERT INTO user_client_access (user_id, client_id)
          VALUES (${adminUserId}, ${clientId})
          ON CONFLICT DO NOTHING
        `

        const future = new Date(Date.now() + 100 * 24 * 3600 * 1000)
        await c`
          INSERT INTO user_connections (
            user_id, provider, external_account_id, client_id, scope_type,
            scopes, access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at
          )
          VALUES (
            ${adminUserId}, 'intuit', 'realm-002', ${clientId}, 'full',
            'com.intuit.quickbooks.accounting openid', 'a', 'r', ${future}, ${future}
          )
        `

        await request(app.getHttpServer())
          .delete(`/v1/clients/${clientId}/intuit/connection`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204)

        const remaining = (await c`
          SELECT count(*)::int AS n FROM user_connections
          WHERE client_id = ${clientId} AND provider = 'intuit'
        `) as unknown as { n: number }[]
        expect(remaining[0]?.n).toBe(0)

        const stillClient = (await c`
          SELECT count(*)::int AS n FROM clients WHERE id = ${clientId}
        `) as unknown as { n: number }[]
        expect(stillClient[0]?.n).toBe(1)
      } finally {
        await c.end()
      }
    })
  })

  describe('SMK-intuit-004 — cascade delete clients → user_connections', () => {
    it('al borrar cliente, las conexiones Intuit asociadas se borran por FK', async () => {
      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      try {
        const [client] = (await c`
          INSERT INTO clients (legal_name, qbo_realm_id, status)
          VALUES ('Cascade LLC', 'realm-003', 'active')
          RETURNING id
        `) as unknown as { id: string }[]
        const clientId = client.id

        const future = new Date(Date.now() + 100 * 24 * 3600 * 1000)
        await c`
          INSERT INTO user_connections (
            user_id, provider, external_account_id, client_id, scope_type,
            scopes, access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at
          )
          VALUES (
            ${adminUserId}, 'intuit', 'realm-003', ${clientId}, 'full',
            'com.intuit.quickbooks.accounting openid', 'a', 'r', ${future}, ${future}
          )
        `

        await c`DELETE FROM clients WHERE id = ${clientId}`

        const orphans = (await c`
          SELECT count(*)::int AS n FROM user_connections
          WHERE client_id = ${clientId} AND provider = 'intuit'
        `) as unknown as { n: number }[]
        expect(orphans[0]?.n).toBe(0)
      } finally {
        await c.end()
      }
    })
  })
})
