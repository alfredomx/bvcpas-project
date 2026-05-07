import { IntuitProvider } from '../../../../src/modules/21-connections/providers/intuit/intuit.provider'
import type { IntuitOauthClientFactory } from '../../../../src/modules/20-intuit-oauth/intuit-oauth-client.factory'
import type { AppConfigService } from '../../../../src/core/config/config.service'
import type { DecryptedUserConnection } from '../../../../src/db/schema/user-connections'
import {
  IntuitAuthorizationError,
  IntuitRefreshTokenExpiredError,
} from '../../../../src/modules/20-intuit-oauth/intuit-oauth.errors'

/**
 * Tests Tipo A para IntuitProvider.
 *
 * Cobertura:
 * - CR-conn-041: refresh con SDK exitoso devuelve TokenRefreshResult con
 *   refreshTokenExpiresIn (Intuit lo expone, distinto a Microsoft).
 * - CR-conn-042: refresh con invalid_grant en mensaje del SDK lanza
 *   IntuitRefreshTokenExpiredError.
 * - CR-conn-043: refresh con error genérico lanza IntuitAuthorizationError.
 * - CR-conn-044: refresh sin refreshToken (null) lanza
 *   IntuitRefreshTokenExpiredError.
 * - CR-conn-045: getProfile lanza error (no implementado a propósito).
 *
 * test() es trivial (un fetch a companyinfo) y se cubre en e2e tipo B.
 */

const NOW = new Date('2026-05-06T12:00:00Z')

function buildConn(overrides: Partial<DecryptedUserConnection> = {}): DecryptedUserConnection {
  return {
    id: 'conn-intuit-1',
    userId: 'user-1',
    provider: 'intuit',
    externalAccountId: '9341057',
    clientId: 'client-elite',
    scopeType: 'full',
    email: null,
    label: null,
    scopes: 'com.intuit.quickbooks.accounting openid',
    accessToken: 'access-current',
    refreshToken: 'refresh-current',
    accessTokenExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000), // 1h
    refreshTokenExpiresAt: new Date(NOW.getTime() + 100 * 24 * 60 * 60 * 1000), // 100d
    ...overrides,
  }
}

interface Mocks {
  cfg: AppConfigService
  factory: jest.Mocked<IntuitOauthClientFactory>
  oauthClient: { refresh: jest.Mock }
}

function makeMocks(): Mocks {
  const oauthClient = { refresh: jest.fn() }
  const factory = {
    create: jest.fn().mockReturnValue(oauthClient),
    applyToken: jest.fn(),
  } as unknown as jest.Mocked<IntuitOauthClientFactory>
  const cfg = {
    intuitMinorVersion: 75,
  } as unknown as AppConfigService
  return { cfg, factory, oauthClient }
}

function buildProvider(m: Mocks): IntuitProvider {
  return new IntuitProvider(m.cfg, m.factory)
}

describe('IntuitProvider', () => {
  describe('CR-conn-041 — refresh exitoso devuelve TokenRefreshResult', () => {
    it('llama factory.applyToken con datos correctos y devuelve refreshTokenExpiresIn', async () => {
      const m = makeMocks()
      m.oauthClient.refresh.mockResolvedValueOnce({
        token: {
          access_token: 'access-new',
          refresh_token: 'refresh-rotated',
          expires_in: 3600,
          x_refresh_token_expires_in: 8640000, // 100 días en segundos
        },
      })

      const provider = buildProvider(m)
      const conn = buildConn()
      const result = await provider.refresh(conn)

      expect(m.factory.applyToken).toHaveBeenCalledWith(
        m.oauthClient,
        expect.objectContaining({
          realmId: '9341057',
          accessToken: 'access-current',
          refreshToken: 'refresh-current',
          accessTokenExpiresAt: conn.accessTokenExpiresAt,
          refreshTokenExpiresAt: conn.refreshTokenExpiresAt,
        }),
      )
      expect(result).toEqual({
        accessToken: 'access-new',
        refreshToken: 'refresh-rotated',
        expiresIn: 3600,
        refreshTokenExpiresIn: 8640000,
        scopes: 'com.intuit.quickbooks.accounting openid',
      })
    })
  })

  describe('CR-conn-042 — refresh con invalid_grant', () => {
    it('lanza IntuitRefreshTokenExpiredError cuando SDK error message incluye invalid_grant', async () => {
      const m = makeMocks()
      m.oauthClient.refresh.mockRejectedValueOnce(new Error('Status 400 invalid_grant'))

      const provider = buildProvider(m)
      await expect(provider.refresh(buildConn())).rejects.toBeInstanceOf(
        IntuitRefreshTokenExpiredError,
      )
    })

    it('detecta también "Refresh token is invalid" del SDK', async () => {
      const m = makeMocks()
      m.oauthClient.refresh.mockRejectedValueOnce(new Error('Refresh token is invalid'))

      const provider = buildProvider(m)
      await expect(provider.refresh(buildConn())).rejects.toBeInstanceOf(
        IntuitRefreshTokenExpiredError,
      )
    })
  })

  describe('CR-conn-043 — error genérico del SDK', () => {
    it('lanza IntuitAuthorizationError si el error no es invalid_grant', async () => {
      const m = makeMocks()
      m.oauthClient.refresh.mockRejectedValueOnce(new Error('Network timeout'))

      const provider = buildProvider(m)
      await expect(provider.refresh(buildConn())).rejects.toBeInstanceOf(IntuitAuthorizationError)
    })
  })

  describe('CR-conn-044 — connection sin refreshToken', () => {
    it('lanza IntuitRefreshTokenExpiredError sin llamar al SDK', async () => {
      const m = makeMocks()
      const provider = buildProvider(m)

      await expect(provider.refresh(buildConn({ refreshToken: null }))).rejects.toBeInstanceOf(
        IntuitRefreshTokenExpiredError,
      )
      expect(m.factory.applyToken).not.toHaveBeenCalled()
    })

    it('lanza IntuitAuthorizationError si refreshTokenExpiresAt es null', async () => {
      const m = makeMocks()
      const provider = buildProvider(m)

      await expect(
        provider.refresh(buildConn({ refreshTokenExpiresAt: null })),
      ).rejects.toBeInstanceOf(IntuitAuthorizationError)
    })
  })

  describe('CR-conn-045 — getProfile no implementado', () => {
    it('lanza IntuitAuthorizationError porque realmId viene del callback OAuth', async () => {
      const m = makeMocks()
      const provider = buildProvider(m)

      await expect(provider.getProfile('access-x')).rejects.toBeInstanceOf(IntuitAuthorizationError)
    })
  })
})
