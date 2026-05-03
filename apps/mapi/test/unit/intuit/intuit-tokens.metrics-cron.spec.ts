import { IntuitTokensMetricsCron } from '../../../src/modules/20-intuit-oauth/tokens/intuit-tokens.metrics-cron'
import type { IntuitTokensRepository } from '../../../src/modules/20-intuit-oauth/tokens/intuit-tokens.repository'
import type { MetricsService } from '../../../src/core/metrics/metrics.service'
import type { IntuitToken } from '../../../src/db/schema/intuit-tokens'

/**
 * Tests Tipo A para IntuitTokensMetricsCron. Sin DB ni red.
 *
 * Cobertura:
 * - CR-intuit-040: updateGauge calcula días desde refresh_token_expires_at.
 * - CR-intuit-041: error en repo no propaga (resiliente).
 */

const MS_PER_DAY = 24 * 3600 * 1000

function buildToken(daysLeft: number, clientId = 'c1', realmId = 'r1'): IntuitToken {
  return {
    clientId,
    realmId,
    accessTokenEncrypted: 'enc',
    refreshTokenEncrypted: 'enc',
    accessTokenExpiresAt: new Date(),
    refreshTokenExpiresAt: new Date(Date.now() + daysLeft * MS_PER_DAY),
    lastRefreshedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('IntuitTokensMetricsCron', () => {
  describe('CR-intuit-040 — updateGauge calcula días', () => {
    it('set() en gauge para cada token con valor floor(daysLeft)', async () => {
      const setMock = jest.fn()
      const metrics = {
        intuitRefreshTokenDaysUntilExpiry: { set: setMock },
      } as unknown as MetricsService
      const repo = {
        listAll: jest
          .fn()
          .mockResolvedValue([buildToken(30, 'c1', 'r1'), buildToken(101, 'c2', 'r2')]),
      } as unknown as IntuitTokensRepository

      const cron = new IntuitTokensMetricsCron(repo, metrics)
      await cron.updateGauge()

      expect(setMock).toHaveBeenCalledTimes(2)
      // Permitimos -1 día por timing del test (Math.floor con < segundo de drift).
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
      const repo = {
        listAll: jest.fn().mockResolvedValue([buildToken(-5, 'c1', 'r1')]),
      } as unknown as IntuitTokensRepository

      const cron = new IntuitTokensMetricsCron(repo, metrics)
      await cron.updateGauge()

      const [, value] = setMock.mock.calls[0] as [unknown, number]
      expect(value).toBeLessThan(0)
    })
  })

  describe('CR-intuit-041 — error en repo no propaga', () => {
    it('listAll() throws → updateGauge resuelve sin lanzar', async () => {
      const setMock = jest.fn()
      const metrics = {
        intuitRefreshTokenDaysUntilExpiry: { set: setMock },
      } as unknown as MetricsService
      const repo = {
        listAll: jest.fn().mockRejectedValue(new Error('DB caída')),
      } as unknown as IntuitTokensRepository

      const cron = new IntuitTokensMetricsCron(repo, metrics)
      await expect(cron.updateGauge()).resolves.toBeUndefined()
      expect(setMock).not.toHaveBeenCalled()
    })
  })
})
