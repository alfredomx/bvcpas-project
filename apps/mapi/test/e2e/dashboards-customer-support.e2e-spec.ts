import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import postgres from 'postgres'
import { setupTestApp, truncateTables } from '../_setup/test-app'

/**
 * Tests Tipo B (DB real) para el dashboard customer-support.
 *
 * - SMK-dash-001: GET /v1/dashboards/customer-support retorna shape correcto.
 * - SMK-dash-002: counts coinciden con seed (uncats, amas, responded).
 * - SMK-dash-003: monthly histogram correcto.
 * - SMK-dash-004: previous year total correcto.
 * - SMK-dash-005: GET detail con clientId válido.
 * - SMK-dash-006: GET detail con clientId inexistente → 404.
 */

const ADMIN_EMAIL = 'admin-dash@example.com'
const ADMIN_PASSWORD = 'admin-dash-pwd-12345'

interface LoginResponseShape {
  accessToken: string
}

interface ListItemShape {
  client_id: string
  legal_name: string
  stats: {
    uncats_count: number
    amas_count: number
    responded_count: number
    progress_pct: number
    amount_total: string
  }
  monthly: {
    previous_year_total: { uncats: number; amas: number }
    by_month: { month: number; uncats: number; amas: number }[]
  }
}

interface ListResponseShape {
  period: { from: string; to: string }
  items: ListItemShape[]
}

interface DetailResponseShape {
  client: { id: string; legal_name: string }
  followup: { status: string }
  stats: ListItemShape['stats'] & { silent_streak_days: number }
}

describe('Customer Support Dashboard E2E (Tipo B)', () => {
  let app: INestApplication
  let adminToken: string
  let clientId: string

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
        VALUES (${ADMIN_EMAIL}, ${hashed}, 'Admin Dash', 'admin', 'active')
        RETURNING id
      `) as unknown as { id: string }[]
      const adminId = admin.id
      const [client] = (await c`
        INSERT INTO clients (legal_name, qbo_realm_id, status, tier, transactions_filter)
        VALUES ('Dash Co', 'realm-dash', 'active', 'gold', 'all')
        RETURNING id
      `) as unknown as { id: string }[]
      clientId = client.id

      // Seed access para que ClientAccessGuard deje pasar al admin user.
      await c`
        INSERT INTO user_client_access (user_id, client_id)
        VALUES (${adminId}, ${clientId})
      `

      // Seed transacciones: 5 uncats abril 2026, 2 amas abril, 2 uncats enero 2026, 3 uncats año 2025
      await c`
        INSERT INTO client_transactions (
          realm_id, qbo_txn_type, qbo_txn_id, client_id, txn_date,
          category, amount
        ) VALUES
          ('realm-dash', 'Expense', 'tx-a1', ${clientId}, '2026-04-01', 'uncategorized_expense', '100.00'),
          ('realm-dash', 'Expense', 'tx-a2', ${clientId}, '2026-04-05', 'uncategorized_expense', '200.00'),
          ('realm-dash', 'Deposit', 'tx-a3', ${clientId}, '2026-04-10', 'uncategorized_income', '300.00'),
          ('realm-dash', 'Expense', 'tx-a4', ${clientId}, '2026-04-15', 'uncategorized_expense', '400.00'),
          ('realm-dash', 'Expense', 'tx-a5', ${clientId}, '2026-04-20', 'uncategorized_expense', '500.00'),
          ('realm-dash', 'Bill',    'tx-b1', ${clientId}, '2026-04-02', 'ask_my_accountant',     '50.00'),
          ('realm-dash', 'Bill',    'tx-b2', ${clientId}, '2026-04-12', 'ask_my_accountant',     '60.00'),
          ('realm-dash', 'Expense', 'tx-j1', ${clientId}, '2026-01-05', 'uncategorized_expense', '70.00'),
          ('realm-dash', 'Expense', 'tx-j2', ${clientId}, '2026-01-15', 'uncategorized_expense', '80.00'),
          ('realm-dash', 'Expense', 'tx-y1', ${clientId}, '2025-06-01', 'uncategorized_expense', '90.00'),
          ('realm-dash', 'Expense', 'tx-y2', ${clientId}, '2025-07-01', 'uncategorized_expense', '110.00'),
          ('realm-dash', 'Expense', 'tx-y3', ${clientId}, '2025-08-01', 'uncategorized_expense', '120.00')
      `

      // Seed 2 respuestas (de las 7 uncats totales en el rango)
      // completed=true para que cuenten en responded_count del dashboard
      await c`
        INSERT INTO client_transaction_responses (
          client_id, realm_id, qbo_txn_type, qbo_txn_id, txn_date,
          category, amount, client_note, completed
        ) VALUES
          (${clientId}, 'realm-dash', 'Expense', 'tx-a1', '2026-04-01', 'uncategorized_expense', '100.00', 'lunch', true),
          (${clientId}, 'realm-dash', 'Expense', 'tx-a2', '2026-04-05', 'uncategorized_expense', '200.00', 'rent', true)
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

  describe('SMK-dash-001/002/003/004 — GET /v1/views/uncats', () => {
    it('retorna shape correcto con counts y monthly', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/views/uncats?from=2025-01-01&to=2026-04-30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as ListResponseShape
      expect(body.period.from).toBe('2025-01-01')
      expect(body.period.to).toBe('2026-04-30')
      expect(body.items).toHaveLength(1)

      const item = body.items[0]
      expect(item.client_id).toBe(clientId)
      expect(item.legal_name).toBe('Dash Co')

      // Stats: 5 abril + 2 enero + 3 año pasado = 10 uncats total en rango
      // Pero el rango es 2025-01-01 a 2026-04-30, así que cuenta TODO
      expect(item.stats.uncats_count).toBe(10)
      expect(item.stats.amas_count).toBe(2)
      expect(item.stats.responded_count).toBe(2)
      expect(item.stats.progress_pct).toBe(20) // 2/10
      // 5 abril (100+200+300+400+500=1500) + 2 enero (70+80=150) + 3 año pasado (90+110+120=320) = 1970
      expect(parseFloat(item.stats.amount_total)).toBeCloseTo(1970, 2)

      // Monthly: año actual = 2026
      const jan = item.monthly.by_month.find((m) => m.month === 1)!
      const apr = item.monthly.by_month.find((m) => m.month === 4)!
      const may = item.monthly.by_month.find((m) => m.month === 5)!
      expect(jan.uncats).toBe(2)
      expect(apr.uncats).toBe(5)
      expect(apr.amas).toBe(2)
      expect(may.uncats).toBe(0)

      // Previous year (2025)
      expect(item.monthly.previous_year_total.uncats).toBe(3)
      expect(item.monthly.previous_year_total.amas).toBe(0)
    })
  })

  describe('SMK-dash-005 — GET detail con clientId válido', () => {
    it('retorna detalle con silent_streak_days y followup', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/uncats?from=2025-01-01&to=2026-04-30`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = res.body as DetailResponseShape
      expect(body.client.id).toBe(clientId)
      expect(body.client.legal_name).toBe('Dash Co')
      expect(body.followup.status).toBe('pending') // sin row, default
      expect(body.stats.uncats_count).toBe(10)
      // v0.13.0: sin followup row (lastFullyRespondedAt=null) + uncat más vieja
      // 2025-06-01 → C4 usa primer día del mes (2025-06-01) → varios días según
      // fecha actual. Solo verificamos que es > 0 (no 0 como antes).
      expect(body.stats.silent_streak_days).toBeGreaterThan(0)
    })
  })

  describe('SMK-dash-006 — clientId inexistente → 404', () => {
    it('CLIENT_NOT_FOUND', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app.getHttpServer())
        .get(`/v1/clients/${fakeUuid}/uncats?from=2025-01-01&to=2026-04-30`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
      expect((res.body as { code: string }).code).toBe('CLIENT_NOT_FOUND')
    })
  })

  describe('SMK-dash-007 — query sin from/to → 400', () => {
    it('Zod rechaza', async () => {
      await request(app.getHttpServer())
        .get('/v1/views/uncats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
    })
  })
})
