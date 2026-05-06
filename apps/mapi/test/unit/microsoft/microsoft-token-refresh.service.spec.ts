import { MicrosoftTokenRefreshService } from '../../../src/modules/21-microsoft-oauth/tokens/microsoft-token-refresh.service'
import type { MicrosoftTokensService } from '../../../src/modules/21-microsoft-oauth/tokens/microsoft-tokens.service'
import type { AppConfigService } from '../../../src/core/config/config.service'
import type { DecryptedUserMicrosoftToken } from '../../../src/db/schema/user-microsoft-tokens'
import { MicrosoftRefreshExpiredError } from '../../../src/modules/21-microsoft-oauth/microsoft-oauth.errors'

/**
 * Tests Tipo A para MicrosoftTokenRefreshService.
 *
 * Cobertura:
 * - CR-msft-005: getValidAccessToken devuelve access actual si expira en >5min.
 * - CR-msft-006: getValidAccessToken hace refresh si expira en ≤5min, persiste
 *   nuevos tokens (incl. refresh_token rotado) y devuelve nuevo access.
 * - CR-msft-007: refresh con invalid_grant → MicrosoftRefreshExpiredError.
 */

const NOW = new Date('2026-05-05T12:00:00Z')

function buildDecrypted(
  overrides: Partial<DecryptedUserMicrosoftToken> = {},
): DecryptedUserMicrosoftToken {
  return {
    userId: 'user-1',
    microsoftUserId: 'msft-uid-abc',
    email: 'bob@example.com',
    scopes: 'Mail.Send Mail.ReadWrite User.Read offline_access',
    accessToken: 'access-current',
    refreshToken: 'refresh-current',
    accessTokenExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000), // 1h
    ...overrides,
  }
}

interface Mocks {
  tokens: jest.Mocked<MicrosoftTokensService>
  cfg: AppConfigService
  fetchFn: jest.Mock
}

function makeMocks(): Mocks {
  const tokens = {
    getDecryptedByUserId: jest.fn(),
    upsert: jest.fn(),
    deleteByUserId: jest.fn(),
  } as unknown as jest.Mocked<MicrosoftTokensService>

  const cfg = {
    microsoftClientId: 'msft-client-id',
    microsoftClientSecret: 'msft-secret',
    microsoftRedirectUri: 'https://dev.alfredo.mx/v1/microsoft-oauth/callback',
  } as unknown as AppConfigService

  return { tokens, cfg, fetchFn: jest.fn() }
}

function buildService(m: Mocks): MicrosoftTokenRefreshService {
  return new MicrosoftTokenRefreshService(m.tokens, m.cfg, m.fetchFn)
}

describe('MicrosoftTokenRefreshService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('CR-msft-005 — token vigente, no refresh', () => {
    it('devuelve access actual si expira en >5min', async () => {
      const m = makeMocks()
      m.tokens.getDecryptedByUserId.mockResolvedValueOnce(buildDecrypted())
      const svc = buildService(m)

      const token = await svc.getValidAccessToken('user-1')

      expect(token).toBe('access-current')
      expect(m.fetchFn).not.toHaveBeenCalled()
      expect(m.tokens.upsert).not.toHaveBeenCalled()
    })
  })

  describe('CR-msft-006 — refresh + rotación', () => {
    it('hace refresh, persiste nuevos tokens (rotando refresh_token) y devuelve el nuevo access', async () => {
      const m = makeMocks()
      m.tokens.getDecryptedByUserId.mockResolvedValueOnce(
        buildDecrypted({
          accessTokenExpiresAt: new Date(NOW.getTime() + 2 * 60 * 1000), // 2 min
        }),
      )
      m.fetchFn.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access-new',
          refresh_token: 'refresh-rotated',
          expires_in: 3600,
          scope: 'Mail.Send Mail.ReadWrite User.Read offline_access',
          token_type: 'Bearer',
        }),
      })

      const svc = buildService(m)
      const token = await svc.getValidAccessToken('user-1')

      expect(token).toBe('access-new')
      expect(m.fetchFn).toHaveBeenCalledTimes(1)
      const [url, init] = m.fetchFn.mock.calls[0] ?? []
      expect(url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
      expect(init?.method).toBe('POST')

      const bodyStr = init?.body as string
      const params = new URLSearchParams(bodyStr)
      expect(params.get('grant_type')).toBe('refresh_token')
      expect(params.get('refresh_token')).toBe('refresh-current')
      expect(params.get('client_id')).toBe('msft-client-id')
      expect(params.get('client_secret')).toBe('msft-secret')

      expect(m.tokens.upsert).toHaveBeenCalledTimes(1)
      const saved = m.tokens.upsert.mock.calls[0]?.[0]
      expect(saved).toMatchObject({
        userId: 'user-1',
        accessToken: 'access-new',
        refreshToken: 'refresh-rotated',
      })
      expect(saved?.accessTokenExpiresAt.getTime()).toBe(NOW.getTime() + 3600 * 1000)
    })
  })

  describe('CR-msft-007 — invalid_grant en refresh', () => {
    it('lanza MicrosoftRefreshExpiredError', async () => {
      const m = makeMocks()
      m.tokens.getDecryptedByUserId.mockResolvedValueOnce(
        buildDecrypted({
          accessTokenExpiresAt: new Date(NOW.getTime() + 2 * 60 * 1000),
        }),
      )
      m.fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'AADSTS70008: refresh token has expired',
        }),
      })

      const svc = buildService(m)
      await expect(svc.getValidAccessToken('user-1')).rejects.toBeInstanceOf(
        MicrosoftRefreshExpiredError,
      )
    })
  })
})
