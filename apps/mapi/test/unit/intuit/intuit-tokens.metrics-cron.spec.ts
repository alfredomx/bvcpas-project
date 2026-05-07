import { IntuitTokensMetricsCron } from '../../../src/modules/20-intuit-oauth/tokens/intuit-tokens.metrics-cron'
import type { DrizzleDb } from '../../../src/core/db/db.module'
import type { MetricsService } from '../../../src/core/metrics/metrics.service'

/**
 * Tests Tipo A para IntuitTokensMetricsCron. Sin DB real.
 *
 * v0.8.0: el cron ahora consulta `user_connections WHERE provider='intuit'`
 * vía Drizzle directo (no IntuitTokensRepository). Mockeamos
 * `db.select().from().where()` con un encadenamiento mínimo que devuelve
 * un array de rows.
 *
 * Cobertura:
 * - CR-intuit-040: updateGauge calcula días desde refresh_token_expires_at.
 * - CR-intuit-041: error en query no propaga (resiliente).
 * - CR-intuit-042: rows con refresh_token_expires_at NULL se ignoran.
 */

const MS_PER_DAY = 24 * 3600 * 1000

interface ConnRow {
  id: string
  clientId: string | null
  externalAccountId: string
  refreshTokenExpiresAt: Date | null
}

function buildRow(
  daysLeft: number | null,
  clientId: string | null = 'c1',
  realmId = 'r1',
): ConnRow {
  return {
    id: `conn-${realmId}`,
    clientId,
    externalAccountId: realmId,
    refreshTokenExpiresAt: daysLeft === null ? null : new Date(Date.now() + daysLeft * MS_PER_DAY),
  }
}

function makeDb(rows: ConnRow[] | Error): DrizzleDb {
  const where = jest
    .fn()
    .mockReturnValue(rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows))
  const from = jest.fn().mockReturnValue({ where })
  const select = jest.fn().mockReturnValue({ from })
  return { select } as unknown as DrizzleDb
}

describe('IntuitTokensMetricsCron', () => {
  describe('CR-intuit-040 — updateGauge calcula días', () => {
    it('set() en gauge para cada token con valor floor(daysLeft)', async () => {
      const setMock = jest.fn()
      const metrics = {
        intuitRefreshTokenDaysUntilExpiry: { set: setMock },
      } as unknown as MetricsService
      const db = makeDb([buildRow(30, 'c1', 'r1'), buildRow(101, 'c2', 'r2')])

      const cron = new IntuitTokensMetricsCron(db, metrics)
      await cron.updateGauge()

      expect(setMock).toHaveBeenCalledTimes(2)
      const [c1Args, c1Value] = setMock.mock.calls[0] as [Record<string, string>, number]
      expect(c1Args).toEqual({ client_id: 'c1', realm_id: 'r1' })
      expect(c1Value).toBeGreaterThanOrEqual(29)
      expect(c1Value).toBeLessThanOrEqual(30)
    })

    it('refresh ya expirado → valor negativo (no clamp para visibilidad)', async () => {
      const setMock = jest.fn()
      const metrics = {
        intuitRefreshTokenDaysUntilExpiry: { set: setMock },
      } as unknown as MetricsService
      const db = makeDb([buildRow(-5, 'c1', 'r1')])

      const cron = new IntuitTokensMetricsCron(db, metrics)
      await cron.updateGauge()

      const [, value] = setMock.mock.calls[0] as [unknown, number]
      expect(value).toBeLessThan(0)
    })
  })

  describe('CR-intuit-041 — error en query no propaga', () => {
    it('updateGauge resuelve sin lanzar', async () => {
      const setMock = jest.fn()
      const metrics = {
        intuitRefreshTokenDaysUntilExpiry: { set: setMock },
      } as unknown as MetricsService
      const db = makeDb(new Error('DB caída'))

      const cron = new IntuitTokensMetricsCron(db, metrics)
      await expect(cron.updateGauge()).resolves.toBeUndefined()
      expect(setMock).not.toHaveBeenCalled()
    })
  })

  describe('CR-intuit-042 — rows sin refresh_token_expires_at se ignoran', () => {
    it('skip rows con NULL', async () => {
      const setMock = jest.fn()
      const metrics = {
        intuitRefreshTokenDaysUntilExpiry: { set: setMock },
      } as unknown as MetricsService
      const db = makeDb([buildRow(30, 'c1', 'r1'), buildRow(null, 'c2', 'r2')])

      const cron = new IntuitTokensMetricsCron(db, metrics)
      await cron.updateGauge()

      expect(setMock).toHaveBeenCalledTimes(1)
      const [args] = setMock.mock.calls[0] as [Record<string, string>, number]
      expect(args).toEqual({ client_id: 'c1', realm_id: 'r1' })
    })
  })
})
