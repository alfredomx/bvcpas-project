import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import Redis from 'ioredis'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (smoke con DB + Redis reales) para 21-microsoft-oauth.
 *
 * Cobertura:
 * - SMK-msft-001: POST /connect devuelve URL bien formada y guarda state en Redis.
 * - SMK-msft-002: GET /me sin conexión → connected: false.
 * - SMK-msft-003: GET /me con row → connected: true, email, scopes.
 * - SMK-msft-004: DELETE /me borra row.
 *
 * NO se cubre el callback completo (requiere navegador real con consent
 * de Microsoft). Eso se valida manualmente en el flujo dev.alfredo.mx.
 */

const ADMIN_EMAIL = 'admin-msft@example.com'
const ADMIN_PASSWORD = 'admin-msft-pwd-12345'

interface LoginResponseShape {
  accessToken: string
}

interface ConnectResponse {
  authorizationUrl: string
}

interface MeResponse {
  connected: boolean
  email?: string
  scopes?: string
  microsoftUserId?: string
}

describe('Microsoft OAuth E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let userId: string

  beforeAll(async () => {
    app = await setupTestApp()
    await truncateTables()

    const { hash } = await import('bcrypt')
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL requerido')
    const c = postgres(databaseUrl, { max: 1 })
    try {
      const hashed = await hash(ADMIN_PASSWORD, 4)
      const [user] = (await c`
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin Microsoft', 'admin', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      userId = user.id
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

  describe('SMK-msft-001 — POST /v1/microsoft-oauth/connect', () => {
    it('devuelve URL bien formada y guarda state en Redis', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/microsoft-oauth/connect')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as ConnectResponse
      expect(body.authorizationUrl).toMatch(
        /^https:\/\/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/authorize\?/,
      )
      const url = new URL(body.authorizationUrl)
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('scope')).toContain('Mail.Send')
      expect(url.searchParams.get('scope')).toContain('offline_access')
      const state = url.searchParams.get('state')
      expect(state).toMatch(/^[a-f0-9]{48}$/)

      // verificar que el state está en Redis
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) throw new Error('REDIS_URL requerido')
      const redis = new Redis(redisUrl, { lazyConnect: true })
      try {
        await redis.connect()
        const raw = await redis.get(`oauth:state:msft:${state}`)
        expect(raw).not.toBeNull()
        const payload = JSON.parse(raw!) as { user_id: string }
        expect(payload.user_id).toBe(userId)
        await redis.del(`oauth:state:msft:${state}`)
      } finally {
        redis.disconnect()
      }
    })
  })

  describe('SMK-msft-002 — GET /v1/microsoft-oauth/me sin conexión', () => {
    it('devuelve connected: false cuando no hay row', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/microsoft-oauth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as MeResponse
      expect(body.connected).toBe(false)
      expect(body.email).toBeUndefined()
    })
  })

  describe('SMK-msft-003 / 004 — me con row + delete', () => {
    it('me devuelve connected:true después de seed; delete lo desconecta', async () => {
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) throw new Error('DATABASE_URL requerido')
      const c = postgres(databaseUrl, { max: 1 })
      try {
        await c`
          INSERT INTO user_microsoft_tokens (
            user_id, microsoft_user_id, email, scopes,
            access_token_encrypted, refresh_token_encrypted, access_token_expires_at
          ) VALUES (
            ${userId},
            'msft-uid-test',
            'admin-msft@example.com',
            'Mail.Send Mail.ReadWrite User.Read offline_access',
            'enc:fake',
            'enc:fake',
            ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
          )
        `
      } finally {
        await c.end()
      }

      const meBefore = await request(app.getHttpServer())
        .get('/v1/microsoft-oauth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const before = meBefore.body as MeResponse
      expect(before.connected).toBe(true)
      expect(before.email).toBe('admin-msft@example.com')
      expect(before.scopes).toContain('Mail.Send')
      expect(before.microsoftUserId).toBe('msft-uid-test')

      await request(app.getHttpServer())
        .delete('/v1/microsoft-oauth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      const meAfter = await request(app.getHttpServer())
        .get('/v1/microsoft-oauth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect((meAfter.body as MeResponse).connected).toBe(false)
    })
  })
})
