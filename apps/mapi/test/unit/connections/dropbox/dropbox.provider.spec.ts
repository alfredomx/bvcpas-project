import { DropboxProvider } from '../../../../src/modules/21-connections/providers/dropbox/dropbox.provider'
import type { AppConfigService } from '../../../../src/core/config/config.service'
import type { DecryptedUserConnection } from '../../../../src/db/schema/user-connections'
import {
  ConnectionAuthError,
  ConnectionRefreshExpiredError,
} from '../../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para DropboxProvider (v0.9.0).
 *
 * Cobertura:
 * - CR-conn-054: refresh() POST a /oauth2/token con grant_type=refresh_token.
 * - CR-conn-055: refresh() con invalid_grant lanza ConnectionRefreshExpiredError.
 * - CR-conn-056: refresh() sin refreshToken lanza ConnectionRefreshExpiredError.
 * - CR-conn-057: getProfile() retorna { externalAccountId, email } desde get_current_account.
 * - CR-conn-058: test() llama a getProfile y devuelve mensaje OK.
 */

const cfg = {
  dropboxClientId: 'dbx-client',
  dropboxClientSecret: 'dbx-secret',
  dropboxRedirectUri: 'https://x.test/callback',
} as unknown as AppConfigService

const baseConn: DecryptedUserConnection = {
  id: 'conn-1',
  userId: 'u-1',
  provider: 'dropbox',
  externalAccountId: 'dbid:account-1',
  clientId: null,
  scopeType: 'full',
  email: 'user@bv-cpas.com',
  label: null,
  scopes: 'account_info.read files.content.read',
  accessToken: 'AT',
  refreshToken: 'RT',
  accessTokenExpiresAt: new Date(Date.now() + 3600_000),
  refreshTokenExpiresAt: null,
}

function buildProvider(fetchFn: jest.Mock): DropboxProvider {
  return new DropboxProvider(cfg, fetchFn)
}

describe('DropboxProvider', () => {
  describe('CR-conn-054 — refresh OK', () => {
    it('hace POST con grant_type=refresh_token y devuelve TokenRefreshResult', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'NEW_AT',
          refresh_token: 'NEW_RT',
          expires_in: 14400,
          scope: 'account_info.read files.content.read',
          token_type: 'bearer',
          account_id: 'dbid:account-1',
          uid: '12345',
        }),
      })

      const provider = buildProvider(fetchFn)
      const result = await provider.refresh(baseConn)

      expect(fetchFn).toHaveBeenCalledTimes(1)
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://api.dropboxapi.com/oauth2/token')
      expect((init as RequestInit).method).toBe('POST')
      const body = (init as RequestInit).body as string
      expect(body).toContain('grant_type=refresh_token')
      expect(body).toContain('refresh_token=RT')
      expect(body).toContain('client_id=dbx-client')

      expect(result).toEqual({
        accessToken: 'NEW_AT',
        refreshToken: 'NEW_RT',
        expiresIn: 14400,
        scopes: 'account_info.read files.content.read',
      })
    })

    it('si Dropbox no devuelve refresh_token nuevo, conserva el actual', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'NEW_AT',
          expires_in: 14400,
          scope: 'account_info.read',
          token_type: 'bearer',
          account_id: 'dbid:account-1',
          uid: '12345',
        }),
      })
      const result = await buildProvider(fetchFn).refresh(baseConn)
      expect(result.refreshToken).toBe('RT')
    })
  })

  describe('CR-conn-055 — refresh invalid_grant', () => {
    it('mapea invalid_grant a ConnectionRefreshExpiredError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', error_description: 'expired' }),
      })
      await expect(buildProvider(fetchFn).refresh(baseConn)).rejects.toBeInstanceOf(
        ConnectionRefreshExpiredError,
      )
    })

    it('otros errores → ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'server_error' }),
      })
      await expect(buildProvider(fetchFn).refresh(baseConn)).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-056 — refresh sin refresh_token', () => {
    it('lanza ConnectionRefreshExpiredError sin tocar fetch', async () => {
      const fetchFn = jest.fn()
      await expect(
        buildProvider(fetchFn).refresh({ ...baseConn, refreshToken: null }),
      ).rejects.toBeInstanceOf(ConnectionRefreshExpiredError)
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-057 — getProfile', () => {
    it('llama get_current_account y mapea a ProviderProfile', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          account_id: 'dbid:account-99',
          email: 'foo@example.com',
          email_verified: true,
          name: { display_name: 'Foo' },
        }),
      })

      const profile = await buildProvider(fetchFn).getProfile('AT')
      expect(profile).toEqual({
        externalAccountId: 'dbid:account-99',
        email: 'foo@example.com',
      })
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://api.dropboxapi.com/2/users/get_current_account')
      expect((init as RequestInit).method).toBe('POST')
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer AT' })
      // get_current_account no acepta body NI Content-Type — Dropbox responde 400
      // si los mandas. Validamos que el provider los omita.
      expect((init as RequestInit).body).toBeUndefined()
      expect((init as RequestInit).headers).not.toHaveProperty('Content-Type')
    })

    it('si la API falla, ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 401 })
      await expect(buildProvider(fetchFn).getProfile('AT')).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-058 — test() delega a getProfile', () => {
    it('devuelve TestResult OK con mensaje', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          account_id: 'dbid:1',
          email: 'a@b.com',
          email_verified: true,
        }),
      })
      const result = await buildProvider(fetchFn).test(baseConn)
      expect(result.ok).toBe(true)
      expect(result.message).toContain('a@b.com')
    })
  })
})
