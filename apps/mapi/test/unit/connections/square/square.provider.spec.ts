import { SquareProvider } from '../../../../src/modules/21-connections/providers/square/square.provider'
import type { AppConfigService } from '../../../../src/core/config/config.service'
import type { DecryptedUserConnection } from '../../../../src/db/schema/user-connections'
import {
  ConnectionAuthError,
  ConnectionRefreshExpiredError,
} from '../../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para SquareProvider (v0.12.0).
 *
 * Cobertura:
 * - CR-conn-080: refresh() POST a /oauth2/token con grant_type=refresh_token JSON.
 * - CR-conn-081: refresh() 401 → ConnectionRefreshExpiredError.
 * - CR-conn-082: refresh() sin refresh_token → ConnectionRefreshExpiredError sin fetch.
 * - CR-conn-083: refresh() respuesta incompleta → ConnectionAuthError.
 * - CR-conn-084: getProfile() llama /v2/merchants/me y mapea merchant.id.
 * - CR-conn-085: test() delega a getProfile.
 */

const cfg = {
  squareClientId: 'sq-app',
  squareClientSecret: 'sq-secret',
  squareRedirectUri: 'https://x.test/callback',
} as unknown as AppConfigService

const baseConn: DecryptedUserConnection = {
  id: 'conn-square-1',
  userId: 'u-1',
  provider: 'square',
  externalAccountId: 'M-square-merchant',
  clientId: 'bvcpas-1',
  scopeType: 'full',
  email: null,
  label: 'LA Restaurant',
  scopes: 'MERCHANT_PROFILE_READ ORDERS_READ',
  accessToken: 'AT',
  refreshToken: 'RT_OLD',
  accessTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  refreshTokenExpiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
}

function buildProvider(fetchFn: jest.Mock): SquareProvider {
  return new SquareProvider(cfg, fetchFn)
}

describe('SquareProvider', () => {
  describe('CR-conn-080 — refresh OK', () => {
    it('POST /oauth2/token JSON con refresh_token grant + secret', async () => {
      const futureAccess = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'NEW_AT',
          token_type: 'bearer',
          expires_at: futureAccess,
          merchant_id: 'M-square-merchant',
          refresh_token: 'NEW_RT',
        }),
      })

      const result = await buildProvider(fetchFn).refresh(baseConn)

      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://connect.squareup.com/oauth2/token')
      expect((init as RequestInit).method).toBe('POST')
      expect((init as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' })
      const body = JSON.parse((init as RequestInit).body as string) as Record<string, string>
      expect(body).toEqual({
        client_id: 'sq-app',
        client_secret: 'sq-secret',
        grant_type: 'refresh_token',
        refresh_token: 'RT_OLD',
      })

      expect(result.accessToken).toBe('NEW_AT')
      expect(result.refreshToken).toBe('NEW_RT')
      expect(result.expiresIn).toBeGreaterThan(0)
      expect(result.refreshTokenExpiresIn).toBe(90 * 24 * 3600)
    })
  })

  describe('CR-conn-081 — refresh 401', () => {
    it('mapea a ConnectionRefreshExpiredError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'invalid_grant',
      })
      await expect(buildProvider(fetchFn).refresh(baseConn)).rejects.toBeInstanceOf(
        ConnectionRefreshExpiredError,
      )
    })

    it('500 → ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server error',
      })
      await expect(buildProvider(fetchFn).refresh(baseConn)).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-082 — refresh sin refresh_token', () => {
    it('lanza ConnectionRefreshExpiredError sin fetch', async () => {
      const fetchFn = jest.fn()
      await expect(
        buildProvider(fetchFn).refresh({ ...baseConn, refreshToken: null }),
      ).rejects.toBeInstanceOf(ConnectionRefreshExpiredError)
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-083 — refresh respuesta incompleta', () => {
    it('falta refresh_token → ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'NEW_AT', expires_at: new Date().toISOString() }),
      })
      await expect(buildProvider(fetchFn).refresh(baseConn)).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-084 — getProfile', () => {
    it('llama /v2/merchants/me y mapea merchant.id', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          merchant: {
            id: 'M-merchant-99',
            business_name: 'LA Zarzamora',
            country: 'US',
            currency: 'USD',
          },
        }),
      })
      const profile = await buildProvider(fetchFn).getProfile('AT')

      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://connect.squareup.com/v2/merchants/me')
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer AT' })

      expect(profile).toEqual({
        externalAccountId: 'M-merchant-99',
        email: null,
      })
    })

    it('si la API falla → ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      })
      await expect(buildProvider(fetchFn).getProfile('AT')).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-085 — test() delega a getProfile', () => {
    it('devuelve TestResult OK', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ merchant: { id: 'M-merchant-99' } }),
      })
      const result = await buildProvider(fetchFn).test(baseConn)
      expect(result.ok).toBe(true)
      expect(result.message).toContain('M-merchant-99')
    })
  })
})
