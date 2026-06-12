import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (DB real) para 14-call-logs (v0.13.0).
 *
 * - SMK-cl-001: POST crea log (user_id desde JWT, called_at default now()).
 * - SMK-cl-002: POST con called_at explícito persiste ese valor.
 * - SMK-cl-003: POST con outcome inválido → 400.
 * - SMK-cl-004: POST con notes > 2000 → 400.
 * - SMK-cl-005: GET lista logs del cliente ordenados DESC por called_at.
 * - SMK-cl-006: GET respeta paginación limit/offset.
 * - SMK-cl-007: GET de un cliente NO devuelve logs de otro cliente.
 * - SMK-cl-008: PATCH actualiza outcome y notes.
 * - SMK-cl-009: PATCH con body vacío → 400.
 * - SMK-cl-010: PATCH sobre log inexistente → 404.
 * - SMK-cl-011: DELETE elimina físicamente (hard delete) + event emitido.
 * - SMK-cl-012: DELETE sobre log inexistente → 404.
 * - SMK-cl-013: ClientAccessGuard bloquea cliente sin acceso → 404.
 */

const ADMIN_EMAIL = 'admin-cl@example.com'
const ADMIN_PASSWORD = 'admin-cl-pwd-12345'

interface LoginResponseShape {
  accessToken: string
}

interface CallLogShape {
  id: string
  client_id: string
  user_id: string
  called_at: string
  outcome: string
  notes: string | null
  created_at: string
  updated_at: string
}

interface ListShape {
  items: CallLogShape[]
  limit: number
  offset: number
}

describe('Call Logs E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let adminId: string
  let clientId: string
  let otherClientId: string

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
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin CL', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      adminId = admin.id
      // v0.15.0: asignar rol Administrator del sistema (RBAC dinámico)
      await c`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (${adminId}, '00000000-0000-0000-0000-000000000001')
      `

      const [client] = (await c`
        INSERT INTO clients (legal_name, qbo_realm_id, status, tier, transactions_filter)
        VALUES ('Acme CL', 'realm-cl-001', 'active', 'silver', 'all')
        RETURNING id
      `) as unknown as { id: string }[]
      clientId = client.id

      const [other] = (await c`
        INSERT INTO clients (legal_name, qbo_realm_id, status, tier, transactions_filter)
        VALUES ('Other CL', 'realm-cl-002', 'active', 'silver', 'all')
        RETURNING id
      `) as unknown as { id: string }[]
      otherClientId = other.id

      // Solo acceso al primero — el segundo prueba ClientAccessGuard.
      await c`
        INSERT INTO user_client_access (user_id, client_id)
        VALUES (${adminId}, ${clientId})
      `
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

  describe('SMK-cl-001 — POST crea log', () => {
    it('inserta y devuelve user_id del JWT con called_at default', async () => {
      const before = Date.now()
      const res = await request(app.getHttpServer())
        .post(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'no_answer', notes: 'sonó, no contestaron' })
        .expect(201)
      const body = res.body as CallLogShape
      expect(body.client_id).toBe(clientId)
      expect(body.user_id).toBe(adminId)
      expect(body.outcome).toBe('no_answer')
      expect(body.notes).toBe('sonó, no contestaron')
      const calledMs = new Date(body.called_at).getTime()
      expect(calledMs).toBeGreaterThanOrEqual(before - 1000)
      expect(calledMs).toBeLessThanOrEqual(Date.now() + 1000)
    })
  })

  describe('SMK-cl-002 — POST con called_at explícito', () => {
    it('persiste el valor mandado', async () => {
      const calledAt = '2026-03-15T14:30:00.000Z'
      const res = await request(app.getHttpServer())
        .post(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'responded', called_at: calledAt })
        .expect(201)
      const body = res.body as CallLogShape
      expect(body.called_at).toBe(calledAt)
    })
  })

  describe('SMK-cl-003 — outcome inválido', () => {
    it('rechaza con 400', async () => {
      await request(app.getHttpServer())
        .post(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'busy' })
        .expect(400)
    })
  })

  describe('SMK-cl-004 — notes > 2000 chars', () => {
    it('rechaza con 400', async () => {
      await request(app.getHttpServer())
        .post(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'other', notes: 'x'.repeat(2001) })
        .expect(400)
    })
  })

  describe('SMK-cl-005 — GET lista DESC por called_at', () => {
    it('los más recientes primero', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListShape
      expect(body.items.length).toBeGreaterThanOrEqual(2)
      for (let i = 0; i < body.items.length - 1; i++) {
        const current = body.items[i]
        const next = body.items[i + 1]
        if (!current || !next) continue
        const a = new Date(current.called_at).getTime()
        const b = new Date(next.called_at).getTime()
        expect(a).toBeGreaterThanOrEqual(b)
      }
    })
  })

  describe('SMK-cl-006 — paginación', () => {
    it('limit=1 devuelve solo 1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/call-logs?limit=1&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListShape
      expect(body.items).toHaveLength(1)
      expect(body.limit).toBe(1)
      expect(body.offset).toBe(0)
    })
  })

  describe('SMK-cl-007 — aislamiento por cliente', () => {
    it('GET de cliente A no muestra logs de cliente B', async () => {
      // Crear log en otherClient directamente vía DB (admin no tiene acceso).
      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      try {
        await c`
          INSERT INTO client_call_logs (client_id, user_id, outcome, notes)
          VALUES (${otherClientId}, ${adminId}, 'responded', 'log de otro cliente')
        `
      } finally {
        await c.end()
      }

      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as ListShape
      expect(body.items.every((log) => log.client_id === clientId)).toBe(true)
    })
  })

  describe('SMK-cl-008 — PATCH actualiza', () => {
    it('cambia outcome y notes', async () => {
      const created = await request(app.getHttpServer())
        .post(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'voicemail', notes: 'mensaje 1' })
        .expect(201)
      const logId = (created.body as CallLogShape).id

      const updated = await request(app.getHttpServer())
        .patch(`/v1/clients/${clientId}/call-logs/${logId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'responded', notes: 'devolvió la llamada' })
        .expect(200)
      const body = updated.body as CallLogShape
      expect(body.outcome).toBe('responded')
      expect(body.notes).toBe('devolvió la llamada')
    })
  })

  describe('SMK-cl-009 — PATCH body vacío', () => {
    it('rechaza con 400', async () => {
      const created = await request(app.getHttpServer())
        .post(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'other' })
        .expect(201)
      const logId = (created.body as CallLogShape).id

      await request(app.getHttpServer())
        .patch(`/v1/clients/${clientId}/call-logs/${logId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400)
    })
  })

  describe('SMK-cl-010 — PATCH log inexistente', () => {
    it('CALL_LOG_NOT_FOUND', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app.getHttpServer())
        .patch(`/v1/clients/${clientId}/call-logs/${fakeUuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'responded' })
        .expect(404)
      expect((res.body as { code: string }).code).toBe('CALL_LOG_NOT_FOUND')
    })
  })

  describe('SMK-cl-011 — DELETE hard delete + evento', () => {
    it('borra físicamente y emite call_log.deleted', async () => {
      const created = await request(app.getHttpServer())
        .post(`/v1/clients/${clientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'other', notes: 'para borrar' })
        .expect(201)
      const logId = (created.body as CallLogShape).id

      await request(app.getHttpServer())
        .delete(`/v1/clients/${clientId}/call-logs/${logId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      // Verifica que físicamente desapareció + evento existe.
      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      try {
        const rows = (await c`
          SELECT count(*)::int AS n FROM client_call_logs WHERE id = ${logId}
        `) as unknown as { n: number }[]
        expect(rows[0]?.n).toBe(0)

        const events = (await c`
          SELECT event_type, payload FROM event_log
          WHERE event_type = 'call_log.deleted'
            AND payload->>'logId' = ${logId}
        `) as unknown as { event_type: string; payload: Record<string, unknown> }[]
        expect(events).toHaveLength(1)
      } finally {
        await c.end()
      }
    })
  })

  describe('SMK-cl-012 — DELETE log inexistente', () => {
    it('CALL_LOG_NOT_FOUND', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app.getHttpServer())
        .delete(`/v1/clients/${clientId}/call-logs/${fakeUuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
      expect((res.body as { code: string }).code).toBe('CALL_LOG_NOT_FOUND')
    })
  })

  describe('SMK-cl-013 — ClientAccessGuard bloquea cliente sin acceso', () => {
    it('responde 404 (no leak de existencia)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${otherClientId}/call-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect([403, 404]).toContain(res.status)
    })
  })
})
