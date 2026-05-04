import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (DB real) para 11-clients.
 *
 * - SMK-clients-001: GET /v1/clients lista paginado.
 * - SMK-clients-002: filtros status y search funcionan.
 * - SMK-clients-003: PATCH actualiza campos editables y emite client.updated.
 * - SMK-clients-004: POST :id/status cambia status y emite event.
 * - SMK-clients-005: GET /v1/clients/:id con id inexistente → 404 CLIENT_NOT_FOUND.
 * - SMK-clients-006: PATCH NO permite cambiar id, qbo_realm_id, status (filtra silenciosamente).
 */

const ADMIN_EMAIL = 'admin-clients@example.com'
const ADMIN_PASSWORD = 'admin-clients-pwd-12345'

interface LoginResponseShape {
  accessToken: string
}

interface ClientShape {
  id: string
  legal_name: string
  qbo_realm_id: string | null
  status: 'active' | 'paused' | 'offboarded'
  tier: 'silver' | 'gold' | 'platinum'
  industry: string | null
}

interface ListResponseShape {
  items: ClientShape[]
  total: number
  page: number
  pageSize: number
}

describe('Clients E2E (Tipo B)', () => {
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
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin Clients', 'admin', 'active')
      `
      // Seed 3 clientes con distintos tiers
      await client`
        INSERT INTO clients (legal_name, qbo_realm_id, status, tier)
        VALUES
          ('Acme LLC', 'r-001', 'active', 'silver'),
          ('Beta Corp', 'r-002', 'paused', 'gold'),
          ('Cascade Co', 'r-003', 'active', 'platinum')
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

  describe('SMK-clients-001 — GET /v1/clients listado paginado', () => {
    it('retorna 3 clientes con shape esperado', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListResponseShape
      expect(body.total).toBe(3)
      expect(body.items).toHaveLength(3)
      expect(body.items[0]?.legal_name).toBe('Acme LLC')
      expect(body.page).toBe(1)
      expect(body.pageSize).toBe(50)
    })
  })

  describe('SMK-clients-002 — filtros status y search', () => {
    it('status=paused retorna solo Beta', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/clients?status=paused')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListResponseShape
      expect(body.total).toBe(1)
      expect(body.items[0]?.legal_name).toBe('Beta Corp')
    })

    it('search=acme retorna solo Acme (case-insensitive)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/clients?search=acme')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListResponseShape
      expect(body.total).toBe(1)
      expect(body.items[0]?.legal_name).toBe('Acme LLC')
    })
  })

  describe('SMK-clients-003 — PATCH /v1/clients/:id actualiza', () => {
    it('actualiza industry + emite client.updated', async () => {
      // Primero get the id
      const list = await request(app.getHttpServer())
        .get('/v1/clients?search=Acme')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const acmeId = (list.body as ListResponseShape).items[0].id

      const res = await request(app.getHttpServer())
        .patch(`/v1/clients/${acmeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ industry: 'Construction', notes: 'Cliente VIP' })
        .expect(200)
      expect((res.body as ClientShape).industry).toBe('Construction')

      // Verify event_log
      const databaseUrl = process.env.DATABASE_URL!
      const client = postgres(databaseUrl, { max: 1 })
      try {
        const events = (await client`
          SELECT event_type, payload FROM event_log
          WHERE event_type = 'client.updated' AND resource_id = ${acmeId}
        `) as unknown as { event_type: string; payload: Record<string, unknown> }[]
        expect(events).toHaveLength(1)
        const changedFields = events[0]?.payload.changedFields as string[]
        expect(changedFields).toEqual(expect.arrayContaining(['industry', 'notes']))
      } finally {
        await client.end()
      }
    })
  })

  describe('SMK-clients-004 — POST :id/status', () => {
    it('cambia status active → offboarded y emite client.status_changed', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/clients?search=Cascade')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const cascadeId = (list.body as ListResponseShape).items[0].id

      const res = await request(app.getHttpServer())
        .post(`/v1/clients/${cascadeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'offboarded' })
        .expect(200)
      expect((res.body as ClientShape).status).toBe('offboarded')

      const databaseUrl = process.env.DATABASE_URL!
      const client = postgres(databaseUrl, { max: 1 })
      try {
        const events = (await client`
          SELECT payload FROM event_log
          WHERE event_type = 'client.status_changed' AND resource_id = ${cascadeId}
        `) as unknown as { payload: Record<string, unknown> }[]
        expect(events).toHaveLength(1)
        expect(events[0]?.payload.fromStatus).toBe('active')
        expect(events[0]?.payload.toStatus).toBe('offboarded')
      } finally {
        await client.end()
      }
    })
  })

  describe('SMK-clients-005 — GET con id inexistente → 404', () => {
    it('CLIENT_NOT_FOUND', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${fakeUuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
      expect((res.body as { code: string }).code).toBe('CLIENT_NOT_FOUND')
    })
  })

  describe('SMK-clients-006 — PATCH ignora campos no editables', () => {
    it('intentar cambiar status vía PATCH no surte efecto (filtra silenciosamente)', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/clients?search=Beta')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const betaId = (list.body as ListResponseShape).items[0].id
      const beforeStatus = (list.body as ListResponseShape).items[0].status

      // Mandamos status, pero el DTO no lo acepta — Zod lo rechazará con 400.
      // La intención del test es asegurar que NO llega al service.
      await request(app.getHttpServer())
        .patch(`/v1/clients/${betaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'offboarded' })
        .expect(400)

      // Status sigue intacto
      const after = await request(app.getHttpServer())
        .get(`/v1/clients/${betaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect((after.body as ClientShape).status).toBe(beforeStatus)
    })
  })

  describe('SMK-clients-007 — filtro ?tier=', () => {
    it('?tier=gold retorna solo Beta Corp', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/clients?tier=gold')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListResponseShape
      expect(body.total).toBe(1)
      expect(body.items[0]?.legal_name).toBe('Beta Corp')
    })

    it('?tier=platinum retorna solo Cascade Co', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/clients?tier=platinum')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListResponseShape
      expect(body.total).toBe(1)
      expect(body.items[0]?.legal_name).toBe('Cascade Co')
    })

    it('?tier=invalid → 400', async () => {
      await request(app.getHttpServer())
        .get('/v1/clients?tier=diamond')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
    })
  })

  describe('SMK-clients-008 — PATCH cambia tier', () => {
    it('Acme silver → platinum, response refleja', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/clients?search=Acme')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const acmeId = (list.body as ListResponseShape).items[0].id

      const res = await request(app.getHttpServer())
        .patch(`/v1/clients/${acmeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tier: 'platinum' })
        .expect(200)
      expect((res.body as ClientShape).tier).toBe('platinum')
    })
  })

  describe('SMK-clients-009 — PATCH con tier inválido → 400', () => {
    it('tier=diamond rechazado por Zod', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/clients?search=Beta')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const betaId = (list.body as ListResponseShape).items[0].id

      await request(app.getHttpServer())
        .patch(`/v1/clients/${betaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tier: 'diamond' })
        .expect(400)
    })
  })
})
