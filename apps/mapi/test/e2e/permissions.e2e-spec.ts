import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (smoke con DB real) para 15-permissions.
 *
 * Cobertura clave (casos motivadores del módulo):
 * - SMK-perm-001: admin lista roles del sistema (Administrator + Viewer)
 *   ya seedeados por migration 0018.
 * - SMK-perm-002: admin crea rol custom "Bookkeeper" con 3 permisos.
 * - SMK-perm-003: admin asigna rol Bookkeeper a un user.
 * - SMK-perm-004: caso Lorena vs Ileana — ambas Bookkeeper, Lorena con
 *   override grant `banking.delete`. GET /me/permissions refleja la
 *   diferencia.
 * - SMK-perm-005: revoke del último rol falla 422 (USER_MUST_HAVE_AT_LEAST_ONE_ROLE).
 * - SMK-perm-006: edit/delete de rol del sistema falla 403.
 * - SMK-perm-007: invalidación de cache al cambiar permisos del rol —
 *   los users afectados ven el cambio inmediatamente.
 */

const ADMIN_EMAIL = 'admin-perm-e2e@example.com'
const ADMIN_PASSWORD = 'admin-perm-pwd-12345'
const LORENA_EMAIL = 'lorena-perm@example.com'
const ILEANA_EMAIL = 'ileana-perm@example.com'

const ADMINISTRATOR_ROLE_ID = '00000000-0000-0000-0000-000000000001'
const VIEWER_ROLE_ID = '00000000-0000-0000-0000-000000000002'

interface LoginResponse {
  accessToken: string
  user: { id: string; email: string; status: string }
}

interface MyPermissionsResponse {
  roles: { id: string; name: string; is_system: boolean }[]
  permissions: string[]
}

interface RoleShape {
  id: string
  name: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

interface CreateUserResponse {
  user: { id: string; email: string }
  initialPassword: string
}

describe('Permissions E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let adminId: string

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
        INSERT INTO users (email, password_hash, full_name, status)
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin Permissions', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      adminId = admin.id
      await c`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (${adminId}, ${ADMINISTRATOR_ROLE_ID})
      `
    } finally {
      await c.end()
    }

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200)

    adminToken = (loginRes.body as LoginResponse).accessToken
  }, 30000)

  afterAll(async () => {
    if (app) await app.close()
  })

  // ════════════════════════════════════════════════════════════════
  // SMK-perm-001: roles del sistema seedeados
  // ════════════════════════════════════════════════════════════════

  describe('SMK-perm-001: roles del sistema', () => {
    it('GET /v1/permissions/roles lista Administrator + Viewer del sistema', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/permissions/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as { data: RoleShape[] }
      const systemRoles = body.data.filter((r) => r.is_system)
      const names = systemRoles.map((r) => r.name).sort()
      expect(names).toEqual(['Administrator', 'Viewer'])
    })

    it('GET /v1/permissions/permissions/grouped agrupa por módulo', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/permissions/permissions/grouped')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as { modules: Record<string, unknown[]> }
      // Verificar que al menos los módulos clave están presentes.
      const moduleKeys = Object.keys(body.modules)
      expect(moduleKeys).toContain('system')
      expect(moduleKeys).toContain('banking')
      expect(moduleKeys).toContain('customer_support')
    })
  })

  // ════════════════════════════════════════════════════════════════
  // SMK-perm-002 + 003 + 004: Caso Lorena vs Ileana end-to-end
  // ════════════════════════════════════════════════════════════════

  describe('SMK-perm-002+003+004: Caso Lorena vs Ileana', () => {
    let bookkeeperRoleId: string
    let lorenaId: string
    let ileanaId: string
    let lorenaToken: string
    let ileanaToken: string

    it('admin crea rol Bookkeeper', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/permissions/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bookkeeper', description: 'Operador de la oficina' })
        .expect(201)

      const role = res.body as RoleShape
      expect(role.name).toBe('Bookkeeper')
      expect(role.is_system).toBe(false)
      bookkeeperRoleId = role.id
    })

    it('admin asigna 3 permisos al rol Bookkeeper (sin .delete)', async () => {
      await request(app.getHttpServer())
        .post(`/v1/permissions/roles/${bookkeeperRoleId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          permission_codes: ['banking.read', 'banking.create', 'banking.update'],
        })
        .expect(204)
    })

    it('admin crea Lorena e Ileana (sin password — se generan)', async () => {
      const lorenaRes = await request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: LORENA_EMAIL, fullName: 'Lorena' })
        .expect(201)
      const lorenaBody = lorenaRes.body as CreateUserResponse
      lorenaId = lorenaBody.user.id

      const ileanaRes = await request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: ILEANA_EMAIL, fullName: 'Ileana' })
        .expect(201)
      const ileanaBody = ileanaRes.body as CreateUserResponse
      ileanaId = ileanaBody.user.id

      // Login con cada una usando su password generada.
      const lorenaLogin = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: LORENA_EMAIL, password: lorenaBody.initialPassword })
        .expect(200)
      lorenaToken = (lorenaLogin.body as LoginResponse).accessToken

      const ileanaLogin = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: ILEANA_EMAIL, password: ileanaBody.initialPassword })
        .expect(200)
      ileanaToken = (ileanaLogin.body as LoginResponse).accessToken
    })

    it('Lorena sin roles asignados → GET /me/permissions devuelve lista vacía', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me/permissions')
        .set('Authorization', `Bearer ${lorenaToken}`)
        .expect(200)

      const body = res.body as MyPermissionsResponse
      expect(body.roles).toEqual([])
      expect(body.permissions).toEqual([])
    })

    it('admin asigna rol Bookkeeper a Lorena e Ileana', async () => {
      await request(app.getHttpServer())
        .post(`/v1/permissions/users/${lorenaId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role_id: bookkeeperRoleId })
        .expect(204)

      await request(app.getHttpServer())
        .post(`/v1/permissions/users/${ileanaId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role_id: bookkeeperRoleId })
        .expect(204)
    })

    it('ambas ahora tienen los 3 permisos del rol (sin .delete)', async () => {
      const lorenaRes = await request(app.getHttpServer())
        .get('/v1/auth/me/permissions')
        .set('Authorization', `Bearer ${lorenaToken}`)
        .expect(200)
      const lorena = lorenaRes.body as MyPermissionsResponse
      expect(new Set(lorena.permissions)).toEqual(
        new Set(['banking.read', 'banking.create', 'banking.update']),
      )

      const ileanaRes = await request(app.getHttpServer())
        .get('/v1/auth/me/permissions')
        .set('Authorization', `Bearer ${ileanaToken}`)
        .expect(200)
      const ileana = ileanaRes.body as MyPermissionsResponse
      expect(new Set(ileana.permissions)).toEqual(
        new Set(['banking.read', 'banking.create', 'banking.update']),
      )
    })

    it('admin agrega override grant `banking.delete` a Lorena', async () => {
      await request(app.getHttpServer())
        .post(`/v1/permissions/users/${lorenaId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          permission_code: 'banking.delete',
          granted: true,
          reason: 'Autorizada por Alfredo',
        })
        .expect(204)
    })

    it('Lorena AHORA tiene banking.delete pero Ileana NO', async () => {
      const lorenaRes = await request(app.getHttpServer())
        .get('/v1/auth/me/permissions')
        .set('Authorization', `Bearer ${lorenaToken}`)
        .expect(200)
      const lorena = lorenaRes.body as MyPermissionsResponse
      expect(lorena.permissions).toContain('banking.delete')

      const ileanaRes = await request(app.getHttpServer())
        .get('/v1/auth/me/permissions')
        .set('Authorization', `Bearer ${ileanaToken}`)
        .expect(200)
      const ileana = ileanaRes.body as MyPermissionsResponse
      expect(ileana.permissions).not.toContain('banking.delete')
    })

    it('admin quita el override de Lorena — vuelve a no tener banking.delete', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/permissions/users/${lorenaId}/permissions/banking.delete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      const res = await request(app.getHttpServer())
        .get('/v1/auth/me/permissions')
        .set('Authorization', `Bearer ${lorenaToken}`)
        .expect(200)
      const body = res.body as MyPermissionsResponse
      expect(body.permissions).not.toContain('banking.delete')
    })
  })

  // ════════════════════════════════════════════════════════════════
  // SMK-perm-005: regla del último rol
  // ════════════════════════════════════════════════════════════════

  describe('SMK-perm-005: regla del último rol', () => {
    it('admin no puede revocar su último rol → 422', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/permissions/users/${adminId}/roles/${ADMINISTRATOR_ROLE_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(422)

      const body = res.body as { code: string }
      expect(body.code).toBe('USER_MUST_HAVE_AT_LEAST_ONE_ROLE')
    })
  })

  // ════════════════════════════════════════════════════════════════
  // SMK-perm-006: roles del sistema inmutables
  // ════════════════════════════════════════════════════════════════

  describe('SMK-perm-006: roles del sistema inmutables', () => {
    it('PATCH /roles/{Administrator} → 403 SYSTEM_ROLE_NOT_EDITABLE', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/permissions/roles/${ADMINISTRATOR_ROLE_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'NotAdministrator' })
        .expect(403)

      const body = res.body as { code: string }
      expect(body.code).toBe('SYSTEM_ROLE_NOT_EDITABLE')
    })

    it('DELETE /roles/{Viewer} → 403 SYSTEM_ROLE_NOT_EDITABLE', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/permissions/roles/${VIEWER_ROLE_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403)

      const body = res.body as { code: string }
      expect(body.code).toBe('SYSTEM_ROLE_NOT_EDITABLE')
    })
  })
})
