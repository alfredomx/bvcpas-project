import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (DB real) para 12-customer-support.
 *
 * - SMK-cs-001: GET /transactions con datos seedeados directo en DB.
 * - SMK-cs-002: DELETE individual quita del snapshot.
 * - SMK-cs-003: GET filtro `category` y `filter`.
 * - SMK-cs-004: POST public-links idempotente — segunda llamada retorna mismo token.
 * - SMK-cs-005: POST public-links con force=true revoca el viejo.
 * - SMK-cs-006: revoke endpoint marca revokedAt.
 * - SMK-cs-007: GET público con token válido devuelve transacciones del cliente sin AMAs.
 * - SMK-cs-008: PATCH público guarda nota → upsert response.
 * - SMK-cs-009: PATCH público sobre transacción inexistente → 404.
 * - SMK-cs-010: GET público con token revocado → 410.
 * - SMK-cs-011: GET followups inicial → default pending.
 * - SMK-cs-012: PATCH followups cambia status y emite evento.
 */

const ADMIN_EMAIL = 'admin-cs@example.com'
const ADMIN_PASSWORD = 'admin-cs-pwd-12345'

interface LoginResponseShape {
  accessToken: string
}

interface TransactionShape {
  id: string
  qbo_txn_type: string
  qbo_txn_id: string
  category: string
  amount: string
}

interface PublicTransactionShape {
  id: string
  category: string
  amount: string
  client_note: string | null
}

interface TransactionsListShape {
  items: TransactionShape[]
  total: number
}

interface PublicResponseShape {
  client: { id: string; legal_name: string; transactions_filter: string }
  items: PublicTransactionShape[]
}

interface PublicLinkShape {
  id: string
  token: string
  purpose: string
  revoked_at: string | null
}

interface FollowupShape {
  status: string
  internal_notes: string | null
}

describe('Customer Support E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let clientId: string
  let txn001Id: string
  const realmId = 'realm-cs-001'

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
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin CS', 'admin', 'active')
      `
      const [c] = (await client`
        INSERT INTO clients (legal_name, qbo_realm_id, status, tier, transactions_filter)
        VALUES ('Acme CS', ${realmId}, 'active', 'silver', 'all')
        RETURNING id
      `) as unknown as { id: string }[]
      clientId = c.id

      // Seed transacciones directamente
      const inserted = (await client`
        INSERT INTO client_transactions (
          realm_id, qbo_txn_type, qbo_txn_id, client_id, txn_date, vendor_name,
          memo, split_account, category, amount
        ) VALUES
          (${realmId}, 'Expense', 'tx-001', ${clientId}, '2026-04-01', 'Acme', 'lunch', 'Bank', 'uncategorized_expense', '50.00'),
          (${realmId}, 'Deposit', 'tx-002', ${clientId}, '2026-04-02', '', 'wire', 'Bank', 'uncategorized_income', '1000.00'),
          (${realmId}, 'Bill',    'tx-003', ${clientId}, '2026-04-03', 'X',  'q',     'Bank', 'ask_my_accountant',     '75.00')
        RETURNING id, qbo_txn_id
      `) as unknown as { id: string; qbo_txn_id: string }[]
      txn001Id = inserted.find((r) => r.qbo_txn_id === 'tx-001')!.id
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

  describe('SMK-cs-001 — GET /transactions admin', () => {
    it('lista 3 transacciones', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/transactions?clientId=${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as TransactionsListShape
      expect(body.total).toBe(3)
    })
  })

  describe('SMK-cs-003 — filtros category + filter', () => {
    it('?category=ask_my_accountant retorna solo el AMA', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/transactions?clientId=${clientId}&category=ask_my_accountant`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as TransactionsListShape
      expect(body.total).toBe(1)
      expect(body.items[0]?.qbo_txn_id).toBe('tx-003')
    })

    it('?filter=expense excluye income (admin)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/transactions?clientId=${clientId}&filter=expense`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const body = res.body as TransactionsListShape
      expect(body.items.find((t) => t.qbo_txn_id === 'tx-002')).toBeUndefined()
    })
  })

  describe('SMK-cs-004 — public-links idempotente', () => {
    it('segunda llamada retorna mismo token', async () => {
      const first = await request(app.getHttpServer())
        .post('/v1/public-links')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, purpose: 'uncats' })
        .expect(200)
      const tokenFirst = (first.body as PublicLinkShape).token

      const second = await request(app.getHttpServer())
        .post('/v1/public-links')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, purpose: 'uncats' })
        .expect(200)
      expect((second.body as PublicLinkShape).token).toBe(tokenFirst)
    })
  })

  describe('SMK-cs-007 — GET público excluye AMAs', () => {
    it('cliente con tier=all ve uncats expense + income, sin AMA', async () => {
      const link = await request(app.getHttpServer())
        .post('/v1/public-links')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, purpose: 'uncats' })
        .expect(200)
      const token = (link.body as PublicLinkShape).token

      const res = await request(app.getHttpServer())
        .get(`/v1/public/transactions/${token}`)
        .expect(200)
      const body = res.body as PublicResponseShape
      expect(body.items).toHaveLength(2)
      // No hay tx-003 (es AMA). Verificamos por categories.
      expect(body.items.find((t) => t.category === 'ask_my_accountant')).toBeUndefined()
    })
  })

  describe('SMK-cs-008 — PATCH público guarda nota', () => {
    it('upsert response y verificable vía admin endpoint', async () => {
      const link = await request(app.getHttpServer())
        .post('/v1/public-links')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, purpose: 'uncats' })
        .expect(200)
      const token = (link.body as PublicLinkShape).token

      await request(app.getHttpServer())
        .patch(`/v1/public/transactions/${token}/${txn001Id}`)
        .send({ note: 'gasto de mi viaje' })
        .expect(200)

      // Vuelve a leer; ahora debe traer el client_note.
      const res = await request(app.getHttpServer())
        .get(`/v1/public/transactions/${token}`)
        .expect(200)
      const body = res.body as PublicResponseShape
      const t1 = body.items.find((t) => t.id === txn001Id)
      expect(t1?.client_note).toBe('gasto de mi viaje')

      // Edición sobreescribe (UPDATE)
      await request(app.getHttpServer())
        .patch(`/v1/public/transactions/${token}/${txn001Id}`)
        .send({ note: 'editado' })
        .expect(200)

      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      try {
        const rows = (await c`
          SELECT count(*)::int AS n, max(client_note) AS note
          FROM client_transaction_responses
          WHERE client_id = ${clientId} AND qbo_txn_id = 'tx-001'
        `) as unknown as { n: number; note: string }[]
        expect(rows[0]?.n).toBe(1)
        expect(rows[0]?.note).toBe('editado')
      } finally {
        await c.end()
      }
    })
  })

  describe('SMK-cs-009 — PATCH público con txn inexistente → 404', () => {
    it('TRANSACTION_NOT_FOUND_IN_SNAPSHOT', async () => {
      const link = await request(app.getHttpServer())
        .post('/v1/public-links')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, purpose: 'uncats' })
        .expect(200)
      const token = (link.body as PublicLinkShape).token

      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app.getHttpServer())
        .patch(`/v1/public/transactions/${token}/${fakeUuid}`)
        .send({ note: 'no existe' })
        .expect(404)
      expect((res.body as { code: string }).code).toBe('TRANSACTION_NOT_FOUND_IN_SNAPSHOT')
    })
  })

  describe('SMK-cs-010 — GET público con token revocado → 410', () => {
    it('después de revoke devuelve 410', async () => {
      const link = await request(app.getHttpServer())
        .post('/v1/public-links')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, purpose: 'uncats', force: true })
        .expect(200)
      const linkId = (link.body as PublicLinkShape).id
      const token = (link.body as PublicLinkShape).token

      await request(app.getHttpServer())
        .post(`/v1/public-links/${linkId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      const res = await request(app.getHttpServer())
        .get(`/v1/public/transactions/${token}`)
        .expect(410)
      expect((res.body as { code: string }).code).toBe('PUBLIC_LINK_REVOKED')
    })
  })

  describe('SMK-cs-011 — GET followups default', () => {
    it('si no existe, retorna pending', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/followups?clientId=${clientId}&period=2026-04`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect((res.body as FollowupShape).status).toBe('pending')
    })
  })

  describe('SMK-cs-012 — PATCH followups', () => {
    it('cambia status a sent + emite evento', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/followups?clientId=${clientId}&period=2026-04`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'sent', internalNotes: 'enviado por admin' })
        .expect(200)

      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      try {
        const events = (await c`
          SELECT count(*)::int AS n FROM event_log
          WHERE event_type = 'client_followup.status_changed'
            AND resource_id = ${clientId}
        `) as unknown as { n: number }[]
        expect(events[0]?.n).toBeGreaterThanOrEqual(1)
      } finally {
        await c.end()
      }
    })
  })

  describe('SMK-cs-002 — DELETE individual', () => {
    it('borra del snapshot pero respuesta queda en transaction_responses', async () => {
      // Pre: tx-001 ya tiene response (de SMK-008). La borramos del snapshot.
      await request(app.getHttpServer())
        .delete(`/v1/transactions/${txn001Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      const databaseUrl = process.env.DATABASE_URL!
      const c = postgres(databaseUrl, { max: 1 })
      try {
        const txns = (await c`
          SELECT count(*)::int AS n FROM client_transactions
          WHERE qbo_txn_id = 'tx-001'
        `) as unknown as { n: number }[]
        expect(txns[0]?.n).toBe(0)

        const responses = (await c`
          SELECT count(*)::int AS n FROM client_transaction_responses
          WHERE qbo_txn_id = 'tx-001'
        `) as unknown as { n: number }[]
        expect(responses[0]?.n).toBe(1)
      } finally {
        await c.end()
      }
    })
  })
})
