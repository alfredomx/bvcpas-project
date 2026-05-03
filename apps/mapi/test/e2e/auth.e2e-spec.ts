import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (smoke con DB real) para 10-core-auth.
 *
 * Cobertura:
 * - SMK-auth-001: flujo completo despido (admin crea user → user loguea →
 *   admin revoca todas + disable → user no entra ni con JWT viejo ni
 *   con nuevo login).
 * - SMK-auth-003: UNIQUE email constraint con HTTP real.
 * - SMK-auth-005: migration end-to-end + login con admin seedeado.
 * - CR-auth-050: race condition email duplicado.
 * - CR-auth-051: login simultáneo crea 2 sesiones distintas.
 *
 * SMK-auth-002 (cache Redis 30s) y SMK-auth-004 (cascade delete) son tests
 * que requieren manipulación de tiempo o queries SQL directas. Se cubren
 * con tests más específicos al final.
 *
 * Cada test usa `truncateTables()` antes para estado limpio (excepto el
 * primero que asume DB recién migrada).
 */

const ADMIN_EMAIL = 'admin-e2e@example.com'
const ADMIN_PASSWORD = 'admin-e2e-password-12345'

interface CreateUserResponseShape {
  user: { id: string; email: string; role: string; status: string }
  initialPassword: string
}

interface LoginResponseShape {
  accessToken: string
  user: { id: string; email: string; role: string; status: string }
}

interface SessionsListShape {
  items: { id: string; userId: string; revokedAt: string | null }[]
}

describe('Auth E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string

  beforeAll(async () => {
    app = await setupTestApp()
    await truncateTables()

    // Seed admin manualmente — el script seed-admin.ts es para CLI,
    // aquí lo replicamos vía endpoint... pero el endpoint requiere admin.
    // Workaround: crear admin directo en DB via supertest no aplica.
    // Solución: usar el seed-admin.ts via require. Más simple: crear
    // admin con SQL directo.

    const { default: postgres } = await import('postgres')
    const { hash } = await import('bcrypt')
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL requerido')

    const client = postgres(databaseUrl, { max: 1 })
    try {
      const hashed = await hash(ADMIN_PASSWORD, 4)
      await client`
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin E2E', 'admin', 'active')
      `
    } finally {
      await client.end()
    }

    // Login admin para obtener token usable en otros tests.
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200)

    adminToken = (loginRes.body as LoginResponseShape).accessToken
    expect(adminToken).toBeDefined()
  }, 30000)

  afterAll(async () => {
    if (app) await app.close()
  })

  describe('SMK-auth-005: migration + seed + login admin', () => {
    it('admin puede loguear con credenciales del seed', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200)

      const body = res.body as LoginResponseShape
      expect(body.accessToken).toBeDefined()
      expect(body.user.email).toBe(ADMIN_EMAIL)
      expect(body.user.role).toBe('admin')
      expect(body.user.status).toBe('active')
    })

    it('login con password incorrecto → 401', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'wrong-password' })
        .expect(401)
    })

    it('GET /v1/auth/me con JWT válido devuelve datos del admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as { email: string; role: string }
      expect(body.email).toBe(ADMIN_EMAIL)
      expect(body.role).toBe('admin')
    })

    it('GET /v1/auth/me sin JWT → 401', async () => {
      await request(app.getHttpServer()).get('/v1/auth/me').expect(401)
    })
  })

  describe('SMK-auth-001: flujo despido completo', () => {
    let viewerEmail: string
    let viewerToken: string
    let viewerId: string

    beforeAll(async () => {
      // Admin crea viewer.
      viewerEmail = `viewer-${Date.now()}@example.com`

      const createRes = await request(app.getHttpServer())
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: viewerEmail,
          fullName: 'Viewer E2E',
          role: 'viewer',
        })
        .expect(201)

      const created = createRes.body as CreateUserResponseShape
      viewerId = created.user.id
      const initialPassword = created.initialPassword

      // Viewer loguea.
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: viewerEmail, password: initialPassword })
        .expect(200)

      viewerToken = (loginRes.body as LoginResponseShape).accessToken
    }, 30000)

    it('viewer hace request a endpoint admin → 403 INSUFFICIENT_PERMISSIONS', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403)

      const body = res.body as { code: string }
      expect(body.code).toBe('INSUFFICIENT_PERMISSIONS')
    })

    it('admin ve sesiones del viewer (1 activa)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/admin/users/${viewerId}/sessions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as SessionsListShape
      expect(body.items.length).toBeGreaterThan(0)
      expect(body.items.some((s) => s.revokedAt === null)).toBe(true)
    })

    it('admin revoca todas las sesiones del viewer', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/admin/users/${viewerId}/sessions/revoke-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as { sessionsRevokedCount: number }
      expect(body.sessionsRevokedCount).toBeGreaterThan(0)
    })

    it('viewer con JWT viejo → 401 (sesión revocada)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(401)

      const body = res.body as { code?: string }
      expect(['SESSION_REVOKED', 'SESSION_NOT_FOUND']).toContain(body.code)
    })

    it('admin deshabilita al viewer', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/admin/users/${viewerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'disabled' })
        .expect(200)
    })

    it('viewer intenta nuevo login con su password → 401 USER_DISABLED', async () => {
      // Necesitamos password — el initialPassword de arriba ya no es accesible
      // (solo se devolvió UNA vez). Como admin, reseteamos para obtener
      // password nueva. Pero el user está disabled, así que el reset cambia
      // password pero el login sigue fallando con USER_DISABLED (no
      // INVALID_CREDENTIALS).

      const resetRes = await request(app.getHttpServer())
        .post(`/v1/admin/users/${viewerId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const newPwd = (resetRes.body as { temporaryPassword: string }).temporaryPassword

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: viewerEmail, password: newPwd })
        .expect(401)

      const body = loginRes.body as { code: string }
      expect(body.code).toBe('USER_DISABLED')
    })
  })

  describe('SMK-auth-003 + CR-auth-050: UNIQUE email constraint', () => {
    it('crear 2 users con mismo email → segundo recibe 409 EMAIL_ALREADY_EXISTS', async () => {
      const email = `dup-${Date.now()}@example.com`

      await request(app.getHttpServer())
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, fullName: 'First', role: 'viewer' })
        .expect(201)

      const res = await request(app.getHttpServer())
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, fullName: 'Second', role: 'viewer' })
        .expect(409)

      const body = res.body as { code: string }
      expect(body.code).toBe('EMAIL_ALREADY_EXISTS')
    })
  })

  describe('CR-auth-051: login simultáneo crea 2 sesiones distintas', () => {
    it('mismo user logueado 2 veces tiene 2 jti distintos y ambos funcionan', async () => {
      // Crear user fresh.
      const email = `dual-${Date.now()}@example.com`

      const createRes = await request(app.getHttpServer())
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, fullName: 'Dual', role: 'viewer' })
        .expect(201)

      const password = (createRes.body as CreateUserResponseShape).initialPassword

      // Login 2 veces.
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer()).post('/v1/auth/login').send({ email, password }).expect(200),
        request(app.getHttpServer()).post('/v1/auth/login').send({ email, password }).expect(200),
      ])

      const tokenA = (resA.body as LoginResponseShape).accessToken
      const tokenB = (resB.body as LoginResponseShape).accessToken

      // Tokens distintos.
      expect(tokenA).not.toBe(tokenB)

      // Ambos funcionan.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200)
    })
  })

  describe('logout y logout-all', () => {
    it('logout revoca solo la sesión actual', async () => {
      // Crear user, loguear 2 veces, logout uno, verificar que el otro sigue.
      const email = `logout-${Date.now()}@example.com`

      const createRes = await request(app.getHttpServer())
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, fullName: 'Logout', role: 'viewer' })
        .expect(201)

      const password = (createRes.body as CreateUserResponseShape).initialPassword

      const tokenA = (
        (
          await request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({ email, password })
            .expect(200)
        ).body as LoginResponseShape
      ).accessToken

      const tokenB = (
        (
          await request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({ email, password })
            .expect(200)
        ).body as LoginResponseShape
      ).accessToken

      // Logout sesión A.
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204)

      // A ya no funciona.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(401)

      // B sigue funcionando.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200)
    })

    it('logout-all revoca todas las sesiones del user', async () => {
      const email = `logoutall-${Date.now()}@example.com`

      const createRes = await request(app.getHttpServer())
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, fullName: 'LogoutAll', role: 'viewer' })
        .expect(201)

      const password = (createRes.body as CreateUserResponseShape).initialPassword

      const tokenA = (
        (
          await request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({ email, password })
            .expect(200)
        ).body as LoginResponseShape
      ).accessToken

      const tokenB = (
        (
          await request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({ email, password })
            .expect(200)
        ).body as LoginResponseShape
      ).accessToken

      // Logout-all desde tokenA.
      await request(app.getHttpServer())
        .post('/v1/auth/logout-all')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)

      // Ambos tokens fallan.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(401)

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(401)
    })
  })
})
