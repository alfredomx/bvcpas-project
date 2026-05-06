import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import Redis from 'ioredis'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (smoke con DB + Redis reales) para 21-connections.
 *
 * Cobertura:
 * - SMK-conn-001: POST /microsoft/connect devuelve URL + state en Redis.
 * - SMK-conn-002: GET / con user sin conexiones → array vacío.
 * - SMK-conn-003: GET / con seed → conexiones del user, sin tokens en JSON.
 * - SMK-conn-004: DELETE /:id de otro user → 404.
 * - SMK-conn-005: DELETE /:id propio → row borrado.
 *
 * NO se cubre el callback completo (requiere consent navegador) ni el
 * test() real (requiere Outlook). Se valida manualmente.
 */

const ADMIN_EMAIL = 'admin-conn@example.com'
const ADMIN_PASSWORD = 'admin-conn-pwd-12345'
const OTHER_EMAIL = 'other-conn@example.com'
const OTHER_PASSWORD = 'other-conn-pwd-12345'

interface LoginResponseShape {
  accessToken: string
}

interface ConnectResponse {
  authorizationUrl: string
}

interface ConnectionItemShape {
  id: string
  provider: string
  externalAccountId: string
  email: string | null
  label: string | null
  scopes: string
  accessTokenExpiresAt: string
  createdAt: string
  updatedAt: string
}

interface ListResponseShape {
  items: ConnectionItemShape[]
}

describe('Connections E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let otherToken: string
  let userId: string
  let otherUserId: string

  beforeAll(async () => {
    app = await setupTestApp()
    await truncateTables()

    const { hash } = await import('bcrypt')
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL requerido')
    const c = postgres(databaseUrl, { max: 1 })
    try {
      const adminHashed = await hash(ADMIN_PASSWORD, 4)
      const otherHashed = await hash(OTHER_PASSWORD, 4)
      const [admin] = (await c`
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES (${ADMIN_EMAIL}, ${adminHashed}, 'Admin Conn', 'admin', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      userId = admin.id
      const [other] = (await c`
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES (${OTHER_EMAIL}, ${otherHashed}, 'Other Conn', 'admin', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      otherUserId = other.id
    } finally {
      await c.end()
    }

    const adminLoginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200)
    adminToken = (adminLoginRes.body as LoginResponseShape).accessToken

    const otherLoginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: OTHER_EMAIL, password: OTHER_PASSWORD })
      .expect(200)
    otherToken = (otherLoginRes.body as LoginResponseShape).accessToken
  }, 30000)

  afterAll(async () => {
    await app.close()
  })

  describe('SMK-conn-001 — POST /v1/connections/microsoft/connect', () => {
    it('devuelve URL bien formada y guarda state en Redis', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/connections/microsoft/connect')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'Mi cuenta personal' })
        .expect(200)

      const body = res.body as ConnectResponse
      expect(body.authorizationUrl).toMatch(
        /^https:\/\/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/authorize\?/,
      )
      const url = new URL(body.authorizationUrl)
      expect(url.searchParams.get('scope')).toBe('Mail.Send User.Read offline_access')
      const state = url.searchParams.get('state')
      expect(state).toMatch(/^[a-f0-9]{48}$/)

      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) throw new Error('REDIS_URL requerido')
      const redis = new Redis(redisUrl, { lazyConnect: true })
      try {
        await redis.connect()
        const raw = await redis.get(`oauth:state:msft:${state}`)
        expect(raw).not.toBeNull()
        const payload = JSON.parse(raw!) as { user_id: string; label: string | null }
        expect(payload.user_id).toBe(userId)
        expect(payload.label).toBe('Mi cuenta personal')
        await redis.del(`oauth:state:msft:${state}`)
      } finally {
        redis.disconnect()
      }
    })
  })

  describe('SMK-conn-002 — GET /v1/connections sin conexiones', () => {
    it('devuelve items vacío cuando user no tiene rows', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/connections')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as ListResponseShape
      expect(body.items).toEqual([])
    })
  })

  describe('SMK-conn-003 / 004 / 005 — list + delete con ownership', () => {
    let myConnectionId: string
    let otherConnectionId: string

    beforeAll(async () => {
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) throw new Error('DATABASE_URL requerido')
      const c = postgres(databaseUrl, { max: 1 })
      try {
        const [mine] = (await c`
          INSERT INTO user_connections (
            user_id, provider, external_account_id, email, label,
            scopes, access_token_encrypted, refresh_token_encrypted, access_token_expires_at
          ) VALUES (
            ${userId}, 'microsoft', 'msft-uid-mine', 'admin-conn@example.com', 'Mi conexión',
            'Mail.Send User.Read offline_access',
            'enc:fake', 'enc:fake', ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
          )
          RETURNING id
        `) as unknown as { id: string }[]
        myConnectionId = mine.id

        const [theirs] = (await c`
          INSERT INTO user_connections (
            user_id, provider, external_account_id, email, label,
            scopes, access_token_encrypted, refresh_token_encrypted, access_token_expires_at
          ) VALUES (
            ${otherUserId}, 'microsoft', 'msft-uid-other', 'other-conn@example.com', 'Other conexión',
            'Mail.Send User.Read offline_access',
            'enc:fake', 'enc:fake', ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
          )
          RETURNING id
        `) as unknown as { id: string }[]
        otherConnectionId = theirs.id
      } finally {
        await c.end()
      }
    }, 30000)

    it('SMK-conn-003 — GET / devuelve solo del user actual sin tokens', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/connections')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as ListResponseShape
      expect(body.items).toHaveLength(1)
      const item = body.items[0]
      expect(item.id).toBe(myConnectionId)
      expect(item.provider).toBe('microsoft')
      expect(item.label).toBe('Mi conexión')
      expect(item.email).toBe('admin-conn@example.com')

      const raw = item as unknown as Record<string, unknown>
      expect(raw).not.toHaveProperty('accessToken')
      expect(raw).not.toHaveProperty('accessTokenEncrypted')
      expect(raw).not.toHaveProperty('refreshToken')
      expect(raw).not.toHaveProperty('refreshTokenEncrypted')
    })

    it('SMK-conn-004 — DELETE /:id de otro user → 404', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/connections/${otherConnectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('SMK-conn-005 — DELETE /:id propio → 204 y row borrado', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/connections/${myConnectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      const after = await request(app.getHttpServer())
        .get('/v1/connections')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = after.body as ListResponseShape
      expect(body.items).toEqual([])

      // Other user's connection sigue intacta.
      const otherList = await request(app.getHttpServer())
        .get('/v1/connections')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200)
      expect((otherList.body as ListResponseShape).items).toHaveLength(1)
    })
  })
})
