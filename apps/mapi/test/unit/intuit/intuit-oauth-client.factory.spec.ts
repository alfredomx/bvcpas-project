import {
  IntuitOauthClientFactory,
  type IntuitDecryptedToken,
} from '../../../src/modules/20-intuit-oauth/intuit-oauth-client.factory'
import type { AppConfigService } from '../../../src/core/config/config.service'
import type { OAuthClient } from 'intuit-oauth'

/**
 * Tests Tipo A para IntuitOauthClientFactory. Sin DB ni red.
 *
 * Cobertura:
 * - CR-intuit-005: create() instancia un cliente nuevo (no singleton).
 * - CR-intuit-006: applyToken() pasa shape COMPLETO a setToken (fix D-mapi-v0.x-118):
 *   createdAt + expires_in + x_refresh_token_expires_in calculados desde DB.
 * - CR-intuit-007: applyToken() preserva access_token, refresh_token y realmId.
 * - CR-intuit-008: applyToken() defensivo — token con expiraciones lejanas no rompe.
 */

function buildCfg(): AppConfigService {
  return {
    intuitClientId: 'cid',
    intuitClientSecret: 'csecret',
    intuitRedirectUri: 'https://localhost/callback',
    intuitEnvironment: 'production',
    intuitMinorVersion: 75,
  } as unknown as AppConfigService
}

function buildToken(overrides: Partial<IntuitDecryptedToken> = {}): IntuitDecryptedToken {
  const now = Date.now()
  return {
    realmId: 'realm-abc',
    accessToken: 'access-xyz',
    refreshToken: 'refresh-xyz',
    accessTokenExpiresAt: new Date(now + 3600 * 1000),
    refreshTokenExpiresAt: new Date(now + 100 * 24 * 3600 * 1000),
    ...overrides,
  }
}

describe('IntuitOauthClientFactory', () => {
  describe('CR-intuit-005 — create()', () => {
    it('retorna instancia del SDK con setToken/refresh/makeApiCall', () => {
      const factory = new IntuitOauthClientFactory(buildCfg())
      const client = factory.create()
      expect(typeof client.setToken).toBe('function')
      expect(typeof client.refresh).toBe('function')
      expect(typeof client.makeApiCall).toBe('function')
    })

    it('retorna instancias independientes en cada llamada', () => {
      const factory = new IntuitOauthClientFactory(buildCfg())
      const a = factory.create()
      const b = factory.create()
      expect(a).not.toBe(b)
    })
  })

  describe('CR-intuit-006 — applyToken() shape completo (fix D-mapi-v0.x-118)', () => {
    it('llama setToken con createdAt, expires_in y x_refresh_token_expires_in calculados', () => {
      const factory = new IntuitOauthClientFactory(buildCfg())
      const setTokenMock = jest.fn()
      const client = { setToken: setTokenMock } as unknown as OAuthClient

      const before = Date.now()
      const refreshExpiresAt = new Date(before + 30 * 24 * 3600 * 1000) // 30 días
      const accessExpiresAt = new Date(before + 3600 * 1000) // 1 hora
      const token = buildToken({
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
      })

      factory.applyToken(client, token)
      const after = Date.now()

      expect(setTokenMock).toHaveBeenCalledTimes(1)
      const args = setTokenMock.mock.calls[0]?.[0] as Record<string, unknown>

      expect(typeof args.createdAt).toBe('number')
      expect(args.createdAt).toBeGreaterThanOrEqual(before)
      expect(args.createdAt).toBeLessThanOrEqual(after)

      expect(typeof args.expires_in).toBe('number')
      expect(args.expires_in).toBeGreaterThan(3600 - 5)
      expect(args.expires_in).toBeLessThanOrEqual(3600)

      expect(typeof args.x_refresh_token_expires_in).toBe('number')
      expect(args.x_refresh_token_expires_in).toBeGreaterThan(30 * 24 * 3600 - 5)
      expect(args.x_refresh_token_expires_in).toBeLessThanOrEqual(30 * 24 * 3600)
    })

    it('expires_in queda en 0 cuando access ya expiró (no negativo)', () => {
      const factory = new IntuitOauthClientFactory(buildCfg())
      const setTokenMock = jest.fn()
      const client = { setToken: setTokenMock } as unknown as OAuthClient

      const expired = new Date(Date.now() - 10_000)
      factory.applyToken(client, buildToken({ accessTokenExpiresAt: expired }))

      const args = setTokenMock.mock.calls[0]?.[0] as Record<string, unknown>
      expect(args.expires_in).toBeGreaterThanOrEqual(0)
    })
  })

  describe('CR-intuit-007 — preserva access_token, refresh_token y realmId', () => {
    it('los 3 campos del token llegan a setToken sin transformación', () => {
      const factory = new IntuitOauthClientFactory(buildCfg())
      const setTokenMock = jest.fn()
      const client = { setToken: setTokenMock } as unknown as OAuthClient

      factory.applyToken(
        client,
        buildToken({
          accessToken: 'my-access',
          refreshToken: 'my-refresh',
          realmId: 'my-realm-123',
        }),
      )

      const args = setTokenMock.mock.calls[0]?.[0] as Record<string, unknown>
      expect(args.access_token).toBe('my-access')
      expect(args.refresh_token).toBe('my-refresh')
      expect(args.realmId).toBe('my-realm-123')
    })
  })

  describe('CR-intuit-008 — defensivo', () => {
    it('no rompe con expiraciones futuras lejanas (>1 año)', () => {
      const factory = new IntuitOauthClientFactory(buildCfg())
      const setTokenMock = jest.fn()
      const client = { setToken: setTokenMock } as unknown as OAuthClient

      const farFuture = new Date(Date.now() + 365 * 24 * 3600 * 1000)
      expect(() =>
        factory.applyToken(
          client,
          buildToken({ accessTokenExpiresAt: farFuture, refreshTokenExpiresAt: farFuture }),
        ),
      ).not.toThrow()
      expect(setTokenMock).toHaveBeenCalledTimes(1)
    })
  })
})
