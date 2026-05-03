import { IntuitTokensService } from '../../../src/modules/20-intuit-oauth/tokens/intuit-tokens.service'
import type { IntuitTokensRepository } from '../../../src/modules/20-intuit-oauth/tokens/intuit-tokens.repository'
import type { IntuitOauthClientFactory } from '../../../src/modules/20-intuit-oauth/intuit-oauth-client.factory'
import type { EncryptionService } from '../../../src/core/encryption/encryption.service'
import type { MetricsService } from '../../../src/core/metrics/metrics.service'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import {
  IntuitRefreshTokenExpiredError,
  IntuitTokensNotFoundError,
} from '../../../src/modules/20-intuit-oauth/intuit-oauth.errors'
import type { IntuitToken } from '../../../src/db/schema/intuit-tokens'

/**
 * Tests Tipo A para IntuitTokensService. Sin DB ni red.
 *
 * Cobertura:
 * - CR-intuit-010: getValidTokens devuelve tokens si access vigente.
 * - CR-intuit-011: getValidTokens hace refresh si access expira en <60s.
 * - CR-intuit-012: getValidTokens lanza IntuitRefreshTokenExpiredError si refresh expiró.
 * - CR-intuit-013: getValidTokens lanza IntuitTokensNotFoundError si no hay row.
 * - CR-intuit-014: refresh persiste tokens cifrados, emite evento e incrementa métrica.
 */

const NOW = Date.now()
const FAR_FUTURE = new Date(NOW + 100 * 24 * 3600 * 1000)
const NEAR_EXPIRY = new Date(NOW + 30 * 1000) // dentro del buffer 60s
const EXPIRED = new Date(NOW - 10_000)

function buildToken(overrides: Partial<IntuitToken> = {}): IntuitToken {
  return {
    clientId: 'client-123',
    realmId: 'realm-abc',
    accessTokenEncrypted: 'enc:access',
    refreshTokenEncrypted: 'enc:refresh',
    accessTokenExpiresAt: FAR_FUTURE,
    refreshTokenExpiresAt: FAR_FUTURE,
    lastRefreshedAt: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<IntuitTokensRepository>
  enc: jest.Mocked<EncryptionService>
  oauthClientFactory: jest.Mocked<IntuitOauthClientFactory>
  refreshFn: jest.Mock
  metrics: MetricsService
  events: { log: jest.Mock }
}

function makeMocks(): Mocks {
  const repo = {
    findByClientId: jest.fn(),
    findByRealmId: jest.fn(),
    upsert: jest.fn(),
    updateRefreshed: jest.fn(),
    deleteByClientId: jest.fn(),
    listAll: jest.fn(),
  } as unknown as jest.Mocked<IntuitTokensRepository>

  const enc = {
    encrypt: jest.fn((s: string) => `enc:${s}`),
    decrypt: jest.fn((s: string) => s.replace(/^enc:/, '')),
  } as unknown as jest.Mocked<EncryptionService>

  const refreshFn = jest.fn()
  const oauthClient = {
    setToken: jest.fn(),
    refresh: refreshFn,
  }
  const oauthClientFactory = {
    create: jest.fn(() => oauthClient),
    applyToken: jest.fn(),
  } as unknown as jest.Mocked<IntuitOauthClientFactory>

  const metrics = {
    intuitTokensRefreshTotal: { inc: jest.fn() },
  } as unknown as MetricsService

  const events = { log: jest.fn().mockResolvedValue(undefined) }

  return { repo, enc, oauthClientFactory, refreshFn, metrics, events }
}

describe('IntuitTokensService', () => {
  describe('CR-intuit-010 — getValidTokens devuelve tokens vigentes', () => {
    it('descifra y retorna sin llamar refresh si access > 60s al futuro', async () => {
      const { repo, enc, oauthClientFactory, refreshFn, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(buildToken())

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      const result = await svc.getValidTokens('client-123')

      expect(result.accessToken).toBe('access')
      expect(result.refreshToken).toBe('refresh')
      expect(result.realmId).toBe('realm-abc')
      expect(refreshFn).not.toHaveBeenCalled()
    })
  })

  describe('CR-intuit-011 — refresh automático si access expira en <60s', () => {
    it('llama refresh y persiste tokens nuevos cifrados', async () => {
      const { repo, enc, oauthClientFactory, refreshFn, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(buildToken({ accessTokenExpiresAt: NEAR_EXPIRY }))
      refreshFn.mockResolvedValueOnce({
        token: {
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
          expires_in: 3600,
          x_refresh_token_expires_in: 100 * 24 * 3600,
        },
      })

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      const result = await svc.getValidTokens('client-123')

      expect(refreshFn).toHaveBeenCalledTimes(1)
      expect(result.accessToken).toBe('fresh-access')
      expect(result.refreshToken).toBe('fresh-refresh')
      expect(repo.updateRefreshed).toHaveBeenCalledTimes(1)
      const persistArgs = repo.updateRefreshed.mock.calls[0]?.[1]
      expect(persistArgs?.accessTokenEncrypted).toBe('enc:fresh-access')
      expect(persistArgs?.refreshTokenEncrypted).toBe('enc:fresh-refresh')
    })

    it('usa applyToken de la factory (no setToken directo)', async () => {
      const { repo, enc, oauthClientFactory, refreshFn, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(buildToken({ accessTokenExpiresAt: NEAR_EXPIRY }))
      refreshFn.mockResolvedValueOnce({
        token: {
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 3600,
          x_refresh_token_expires_in: 100 * 24 * 3600,
        },
      })

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      await svc.getValidTokens('client-123')

      expect(oauthClientFactory.applyToken).toHaveBeenCalledTimes(1)
    })
  })

  describe('CR-intuit-012 — refresh expirado lanza IntuitRefreshTokenExpiredError', () => {
    it('si refreshTokenExpiresAt < now, lanza antes de intentar refresh', async () => {
      const { repo, enc, oauthClientFactory, refreshFn, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(
        buildToken({ accessTokenExpiresAt: EXPIRED, refreshTokenExpiresAt: EXPIRED }),
      )

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      await expect(svc.getValidTokens('client-123')).rejects.toBeInstanceOf(
        IntuitRefreshTokenExpiredError,
      )
      expect(refreshFn).not.toHaveBeenCalled()
    })

    it('si Intuit responde invalid_grant durante refresh, lanza IntuitRefreshTokenExpiredError', async () => {
      const { repo, enc, oauthClientFactory, refreshFn, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(buildToken({ accessTokenExpiresAt: NEAR_EXPIRY }))
      refreshFn.mockRejectedValueOnce(new Error('invalid_grant: Token revoked'))

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      await expect(svc.getValidTokens('client-123')).rejects.toBeInstanceOf(
        IntuitRefreshTokenExpiredError,
      )
    })
  })

  describe('CR-intuit-013 — IntuitTokensNotFoundError', () => {
    it('lanza si no hay row para ese clientId', async () => {
      const { repo, enc, oauthClientFactory, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(null)

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      await expect(svc.getValidTokens('missing-client')).rejects.toBeInstanceOf(
        IntuitTokensNotFoundError,
      )
    })
  })

  describe('CR-intuit-014 — refresh emite evento + incrementa métrica', () => {
    it('refresh exitoso emite intuit.tokens.refreshed e incrementa métrica success', async () => {
      const { repo, enc, oauthClientFactory, refreshFn, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(buildToken({ accessTokenExpiresAt: NEAR_EXPIRY }))
      refreshFn.mockResolvedValueOnce({
        token: {
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 3600,
          x_refresh_token_expires_in: 100 * 24 * 3600,
        },
      })

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      await svc.getValidTokens('client-123')

      expect(events.log).toHaveBeenCalledWith(
        'intuit.tokens.refreshed',
        expect.objectContaining({ client_id: 'client-123', realm_id: 'realm-abc' }),
        undefined,
        { type: 'client', id: 'client-123' },
      )
      const incMock = metrics.intuitTokensRefreshTotal.inc as jest.Mock
      expect(incMock).toHaveBeenCalledWith({ client_id: 'client-123', result: 'success' })
    })

    it('refresh con error de red incrementa métrica failed e emite intuit.tokens.refresh_failed', async () => {
      const { repo, enc, oauthClientFactory, refreshFn, metrics, events } = makeMocks()
      repo.findByClientId.mockResolvedValueOnce(buildToken({ accessTokenExpiresAt: NEAR_EXPIRY }))
      refreshFn.mockRejectedValueOnce(new Error('ETIMEDOUT'))

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      await expect(svc.getValidTokens('client-123')).rejects.toThrow('ETIMEDOUT')

      const incMock = metrics.intuitTokensRefreshTotal.inc as jest.Mock
      expect(incMock).toHaveBeenCalledWith({ client_id: 'client-123', result: 'failed' })
      expect(events.log).toHaveBeenCalledWith(
        'intuit.tokens.refresh_failed',
        expect.objectContaining({ client_id: 'client-123' }),
        undefined,
        { type: 'client', id: 'client-123' },
      )
    })
  })

  describe('deleteTokens', () => {
    it('emite intuit.tokens.deleted al borrar', async () => {
      const { repo, enc, oauthClientFactory, metrics, events } = makeMocks()

      const svc = new IntuitTokensService(
        repo,
        enc,
        oauthClientFactory,
        metrics,
        events as unknown as EventLogService,
      )
      await svc.deleteTokens('client-123', 'admin-456')

      expect(repo.deleteByClientId).toHaveBeenCalledWith('client-123')
      expect(events.log).toHaveBeenCalledWith(
        'intuit.tokens.deleted',
        { client_id: 'client-123' },
        'admin-456',
        { type: 'client', id: 'client-123' },
      )
    })
  })
})
