import { GoogleProvider } from '../../../../src/modules/21-connections/providers/google/google.provider'
import type { AppConfigService } from '../../../../src/core/config/config.service'
import type { DecryptedUserConnection } from '../../../../src/db/schema/user-connections'
import {
  ConnectionAuthError,
  ConnectionRefreshExpiredError,
} from '../../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para GoogleProvider (v0.9.0).
 *
 * Cobertura:
 * - CR-conn-059: refresh() POST a /token con grant_type=refresh_token.
 * - CR-conn-060: refresh() invalid_grant → ConnectionRefreshExpiredError.
 * - CR-conn-061: refresh() sin refresh_token → ConnectionRefreshExpiredError.
 * - CR-conn-062: getProfile() retorna { externalAccountId=sub, email }.
 * - CR-conn-063: test() delega a getProfile.
 */

const cfg = {
  googleClientId: 'goog-client',
  googleClientSecret: 'goog-secret',
  googleRedirectUri: 'https://x.test/callback',
} as unknown as AppConfigService

const baseConn: DecryptedUserConnection = {
  id: 'conn-2',
  userId: 'u-1',
  provider: 'google',
  externalAccountId: '109876543210',
  clientId: null,
  scopeType: 'full',
  email: 'user@bv-cpas.com',
  label: null,
  scopes: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
  accessToken: 'AT',
  refreshToken: 'RT',
  accessTokenExpiresAt: new Date(Date.now() + 3600_000),
  refreshTokenExpiresAt: null,
}

function buildProvider(fetchFn: jest.Mock): GoogleProvider {
  return new GoogleProvider(cfg, fetchFn)
}

describe('GoogleProvider', () => {
  describe('CR-conn-059 — refresh OK', () => {
    it('hace POST a /token y devuelve TokenRefreshResult', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'NEW_AT',
          expires_in: 3599,
          scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
          token_type: 'Bearer',
        }),
      })

      const result = await buildProvider(fetchFn).refresh(baseConn)

      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://oauth2.googleapis.com/token')
      expect((init as RequestInit).method).toBe('POST')
      const body = (init as RequestInit).body as string
      expect(body).toContain('grant_type=refresh_token')
      expect(body).toContain('refresh_token=RT')

      // Google no rota refresh_token: conserva el actual.
      expect(result).toEqual({
        accessToken: 'NEW_AT',
        refreshToken: 'RT',
        expiresIn: 3599,
        scopes: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
      })
    })
  })

  describe('CR-conn-060 — refresh invalid_grant', () => {
    it('mapea a ConnectionRefreshExpiredError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      })
      await expect(buildProvider(fetchFn).refresh(baseConn)).rejects.toBeInstanceOf(
        ConnectionRefreshExpiredError,
      )
    })

    it('otros errores → ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal' }),
      })
      await expect(buildProvider(fetchFn).refresh(baseConn)).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-061 — refresh sin refresh_token', () => {
    it('lanza ConnectionRefreshExpiredError sin llamar fetch', async () => {
      const fetchFn = jest.fn()
      await expect(
        buildProvider(fetchFn).refresh({ ...baseConn, refreshToken: null }),
      ).rejects.toBeInstanceOf(ConnectionRefreshExpiredError)
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-062 — getProfile', () => {
    it('llama userinfo y mapea sub a externalAccountId', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: '109876543210',
          email: 'foo@gmail.com',
          email_verified: true,
          name: 'Foo',
        }),
      })
      const profile = await buildProvider(fetchFn).getProfile('AT')
      expect(profile).toEqual({
        externalAccountId: '109876543210',
        email: 'foo@gmail.com',
      })
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://openidconnect.googleapis.com/v1/userinfo')
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer AT' })
    })

    it('si la API falla, ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 401 })
      await expect(buildProvider(fetchFn).getProfile('AT')).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-063 — test() delega a getProfile', () => {
    it('devuelve TestResult OK con mensaje', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: '1', email: 'a@b.com', email_verified: true }),
      })
      const result = await buildProvider(fetchFn).test(baseConn)
      expect(result.ok).toBe(true)
      expect(result.message).toContain('a@b.com')
    })
  })
})
