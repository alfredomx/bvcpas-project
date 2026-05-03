import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (smoke con DB real) para 20-intuit-oauth.
 *
 * Cobertura:
 * - SMK-intuit-001: GET /v1/intuit/tokens responde 200 con lista vacía y
 *   200 con items cuando hay tokens en DB.
 * - SMK-intuit-002: GET /v1/intuit/tokens NO incluye access_token ni
 *   refresh_token plaintext en la respuesta (solo metadata).
 * - SMK-intuit-003: DELETE /v1/intuit/tokens/:clientId borra y emite evento.
 * - SMK-intuit-004: cascade delete clients → intuit_tokens al borrar cliente.
 *
 * El flow OAuth completo (callback con SDK Intuit) se cubre en tests
 * unitarios; aquí solo verificamos que los endpoints HTTP estén bien
 * cableados y persisten en DB.
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

  beforeAll(async () => {
    app = await setupTestApp()
    await truncateTables()

    const { hash } = await import('bcrypt')
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL requerido')
    const client = postgres(databaseUrl, { max: 1 })
    try {
      const hashed = await hash(ADMIN_PASSWORD, 4)
      await client`
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin Intuit', 'admin', 'active')
      `
    } finally {
      await client.end()
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

  describe('SMK-intuit-001 — GET /v1/intuit/tokens', () => {
    it('lista vacía cuando no hay tokens', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/intuit/tokens')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect((res.body as TokensListShape).items).toEqual([])
    })

    it('retorna items con metadata cuando existen tokens en DB', async () => {
      const databaseUrl = process.env.DATABASE_URL!
      const client = postgres(databaseUrl, { max: 1 })
      let clientId: string
      try {
        const [c] = (await client`
          INSERT INTO clients (legal_name, qbo_realm_id, status)
          VALUES ('Acme Corp', 'realm-001', 'active')
          RETURNING id
        `) as unknown as { id: string }[]
        clientId = c.id

        const future = new Date(Date.now() + 100 * 24 * 3600 * 1000)
        const accessFuture = new Date(Date.now() + 3600 * 1000)
        await client`
          INSERT INTO intuit_tokens (
            client_id, realm_id, access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at
          )
          VALUES (
            ${clientId}, 'realm-001', 'enc-access', 'enc-refresh',
            ${accessFuture}, ${future}
          )
        `
      } finally {
        await client.end()
      }

      const res = await request(app.getHttpServer())
        .get('/v1/intuit/tokens')
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
        .get('/v1/intuit/tokens')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const stringified = JSON.stringify(res.body)
      // Nada del ciphertext que metimos en SMK-001 ('enc-access', 'enc-refresh').
      expect(stringified).not.toContain('enc-access')
      expect(stringified).not.toContain('enc-refresh')
      // Ni los nombres del campo encrypted (que sería un leak de implementación).
      expect(stringified).not.toContain('access_token_encrypted')
      expect(stringified).not.toContain('refresh_token_encrypted')
    })
  })

  describe('SMK-intuit-003 — DELETE /v1/intuit/tokens/:clientId', () => {
    it('borra los tokens y deja al cliente intacto', async () => {
      const databaseUrl = process.env.DATABASE_URL!
      const client = postgres(databaseUrl, { max: 1 })
      let clientId: string
      try {
        const [c] = (await client`
          INSERT INTO clients (legal_name, qbo_realm_id, status)
          VALUES ('Beta Inc', 'realm-002', 'active')
          RETURNING id
        `) as unknown as { id: string }[]
        clientId = c.id

        const future = new Date(Date.now() + 100 * 24 * 3600 * 1000)
        await client`
          INSERT INTO intuit_tokens (
            client_id, realm_id, access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at
          )
          VALUES (
            ${clientId}, 'realm-002', 'a', 'r', ${future}, ${future}
          )
        `

        await request(app.getHttpServer())
          .delete(`/v1/intuit/tokens/${clientId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204)

        const remaining = (await client`
          SELECT count(*)::int AS n FROM intuit_tokens WHERE client_id = ${clientId}
        `) as unknown as { n: number }[]
        expect(remaining[0]?.n).toBe(0)

        const stillClient = (await client`
          SELECT count(*)::int AS n FROM clients WHERE id = ${clientId}
        `) as unknown as { n: number }[]
        expect(stillClient[0]?.n).toBe(1)
      } finally {
        await client.end()
      }
    })
  })

  describe('SMK-intuit-004 — cascade delete clients → intuit_tokens', () => {
    it('al borrar cliente, los intuit_tokens asociados se borran por FK', async () => {
      const databaseUrl = process.env.DATABASE_URL!
      const client = postgres(databaseUrl, { max: 1 })
      try {
        const [c] = (await client`
          INSERT INTO clients (legal_name, qbo_realm_id, status)
          VALUES ('Cascade LLC', 'realm-003', 'active')
          RETURNING id
        `) as unknown as { id: string }[]
        const clientId = c.id

        const future = new Date(Date.now() + 100 * 24 * 3600 * 1000)
        await client`
          INSERT INTO intuit_tokens (
            client_id, realm_id, access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at
          )
          VALUES (
            ${clientId}, 'realm-003', 'a', 'r', ${future}, ${future}
          )
        `

        await client`DELETE FROM clients WHERE id = ${clientId}`

        const orphans = (await client`
          SELECT count(*)::int AS n FROM intuit_tokens WHERE client_id = ${clientId}
        `) as unknown as { n: number }[]
        expect(orphans[0]?.n).toBe(0)
      } finally {
        await client.end()
      }
    })
  })
})
