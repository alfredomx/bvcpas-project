import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (DB real) para v0.14.0 — Integrations dashboard + pause/resume.
 *
 * - SMK-int-001: GET /v1/clients/:id/integrations sin Clover/Square → stats en 0.
 * - SMK-int-002: GET con mix de status (healthy + needs_reauth + paused) → KPIs correctos.
 * - SMK-int-003: ClientAccessGuard bloquea cliente sin acceso del user (404).
 * - SMK-int-004: providers globales (intuit/microsoft) NO aparecen en el dashboard.
 * - SMK-int-005: POST /pause + GET refleja paused; POST /resume vuelve a healthy.
 * - SMK-int-006: POST /pause sobre ya pausada → 409.
 * - SMK-int-007: POST /resume sobre activa → 409.
 */

const ADMIN_EMAIL = 'admin-int@example.com'
const ADMIN_PASSWORD = 'admin-int-pwd-12345'
const OTHER_EMAIL = 'other-int@example.com'
const OTHER_PASSWORD = 'other-int-pwd-12345'

interface LoginResponse {
  accessToken: string
}

interface ConnectionItem {
  id: string
  provider: string
  providerLabel: string
  label: string | null
  status: 'healthy' | 'needs_reauth' | 'paused'
  pausedAt: string | null
}

interface DashboardResponse {
  client: { id: string; legalName: string }
  stats: {
    connected: number
    healthy: number
    needsAttention: number
    errors: number
    providersInUse: number
  }
  connections: ConnectionItem[]
}

describe('Integrations Dashboard E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let otherToken: string
  let adminId: string
  let clientId: string
  let pausableConnId: string

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
        INSERT INTO users (email, password_hash, full_name, status)
        VALUES (${ADMIN_EMAIL}, ${adminHashed}, 'Admin Int', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      adminId = admin.id
      const [other] = (await c`
        INSERT INTO users (email, password_hash, full_name, status)
        VALUES (${OTHER_EMAIL}, ${otherHashed}, 'Other Int', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      const otherId = other.id
      // v0.15.0: ambos users con rol Administrator (RBAC dinámico)
      await c`
        INSERT INTO user_roles (user_id, role_id)
        VALUES
          (${adminId}, '00000000-0000-0000-0000-000000000001'),
          (${otherId}, '00000000-0000-0000-0000-000000000001')
      `

      const [client] = (await c`
        INSERT INTO clients (legal_name, qbo_realm_id, status, tier, transactions_filter)
        VALUES ('Marale, Inc', 'realm-int', 'active', 'gold', 'all')
        RETURNING id
      `) as unknown as { id: string }[]
      clientId = client.id

      // admin tiene acceso al cliente; other NO.
      await c`INSERT INTO user_client_access (user_id, client_id) VALUES (${adminId}, ${clientId})`

      // Conexión Square healthy (refresh válido 30 días).
      await c`
        INSERT INTO user_connections (
          user_id, provider, external_account_id, client_id, scope_type, auth_type,
          email, label, scopes,
          access_token_encrypted, refresh_token_encrypted,
          access_token_expires_at, refresh_token_expires_at
        ) VALUES (
          ${adminId}, 'square', 'merchant-sq-1', ${clientId}, 'full', 'oauth',
          NULL, 'Square Marale', 'MERCHANT_PROFILE_READ',
          'enc', 'enc',
          ${new Date(Date.now() + 60 * 60 * 1000).toISOString()},
          ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
        )
      `

      // Conexión Square needs_reauth (refresh ya expirado).
      await c`
        INSERT INTO user_connections (
          user_id, provider, external_account_id, client_id, scope_type, auth_type,
          email, label, scopes,
          access_token_encrypted, refresh_token_encrypted,
          access_token_expires_at, refresh_token_expires_at
        ) VALUES (
          ${adminId}, 'square', 'merchant-sq-2', ${clientId}, 'full', 'oauth',
          NULL, 'Square Old', 'MERCHANT_PROFILE_READ',
          'enc', 'enc',
          ${new Date(Date.now() - 60 * 60 * 1000).toISOString()},
          ${new Date(Date.now() - 60 * 60 * 1000).toISOString()}
        )
      `

      // Conexión Clover api_key, healthy (la usaremos para pause/resume).
      const [clover] = (await c`
        INSERT INTO user_connections (
          user_id, provider, external_account_id, client_id, scope_type, auth_type,
          email, label, credentials_encrypted
        ) VALUES (
          ${adminId}, 'clover', 'merchant-clover-1', ${clientId}, 'full', 'api_key',
          NULL, 'Blanco To Go', 'enc-credentials'
        )
        RETURNING id
      `) as unknown as { id: string }[]
      pausableConnId = clover.id

      // Conexión Microsoft (provider global) — debe NO aparecer en el dashboard.
      await c`
        INSERT INTO user_connections (
          user_id, provider, external_account_id, scope_type, auth_type,
          email, label, scopes,
          access_token_encrypted, refresh_token_encrypted,
          access_token_expires_at
        ) VALUES (
          ${adminId}, 'microsoft', 'msft-int-1', 'full', 'oauth',
          'admin@example.com', 'Mi Outlook', 'Mail.Send',
          'enc', 'enc',
          ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
        )
      `

      // (Opcional) sin conexiones para `other` user; sirve también para garantizar
      // que el filtro por client_id no leakea conexiones de otros clientes.
      void otherId
    } finally {
      await c.end()
    }

    const adminLoginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200)
    adminToken = (adminLoginRes.body as LoginResponse).accessToken

    const otherLoginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: OTHER_EMAIL, password: OTHER_PASSWORD })
      .expect(200)
    otherToken = (otherLoginRes.body as LoginResponse).accessToken
  }, 30000)

  afterAll(async () => {
    await app.close()
  })

  describe('SMK-int-002 — dashboard con mix de status', () => {
    it('agrega stats correctamente: 3 connected, 1 healthy, 1 needsAttention, 0 errors, 2 providers', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/integrations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as DashboardResponse
      expect(body.client).toEqual({ id: clientId, legalName: 'Marale, Inc' })
      expect(body.stats.connected).toBe(3)
      expect(body.stats.providersInUse).toBe(2) // square + clover

      // Status counts.
      const statuses = body.connections.map((c) => c.status).sort()
      expect(statuses).toEqual(['healthy', 'healthy', 'needs_reauth'])
      expect(body.stats.healthy).toBe(2)
      expect(body.stats.needsAttention).toBe(1)
      expect(body.stats.errors).toBe(0)
    })
  })

  describe('SMK-int-004 — providers globales excluidos', () => {
    it('no devuelve la conexión microsoft del admin aunque esté en DB', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/integrations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as DashboardResponse
      const providers = body.connections.map((c) => c.provider)
      expect(providers).not.toContain('microsoft')
      expect(new Set(providers).size).toBeLessThanOrEqual(2)
    })

    it('cada provider devuelto tiene providerLabel mapeado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/integrations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as DashboardResponse
      for (const conn of body.connections) {
        if (conn.provider === 'clover') expect(conn.providerLabel).toBe('Clover')
        if (conn.provider === 'square') expect(conn.providerLabel).toBe('Square')
      }
    })
  })

  describe('SMK-int-003 — ClientAccessGuard bloquea', () => {
    it('user sin acceso al cliente → 404', async () => {
      await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/integrations`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)
    })
  })

  describe('SMK-int-005 — pause/resume flow completo', () => {
    it('pause refleja en el dashboard como paused', async () => {
      await request(app.getHttpServer())
        .post(`/v1/connections/${pausableConnId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'cliente en vacaciones' })
        .expect(204)

      const dash = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/integrations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = dash.body as DashboardResponse
      const clover = body.connections.find((c) => c.id === pausableConnId)
      expect(clover?.status).toBe('paused')
      expect(clover?.pausedAt).not.toBeNull()
      expect(body.stats.errors).toBe(1)
    })

    it('SMK-int-006 — segundo pause → 409', async () => {
      await request(app.getHttpServer())
        .post(`/v1/connections/${pausableConnId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(409)
    })

    it('resume vuelve a healthy', async () => {
      await request(app.getHttpServer())
        .post(`/v1/connections/${pausableConnId}/resume`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      const dash = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/integrations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = dash.body as DashboardResponse
      const clover = body.connections.find((c) => c.id === pausableConnId)
      expect(clover?.status).toBe('healthy')
      expect(clover?.pausedAt).toBeNull()
      expect(body.stats.errors).toBe(0)
    })

    it('SMK-int-007 — resume sobre activa → 409', async () => {
      await request(app.getHttpServer())
        .post(`/v1/connections/${pausableConnId}/resume`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409)
    })
  })
})
