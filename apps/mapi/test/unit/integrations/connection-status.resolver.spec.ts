import { ConnectionStatusResolver } from '../../../src/modules/13-views/integrations/connection-status.resolver'
import type { UserConnection } from '../../../src/db/schema/user-connections'

/**
 * Tests Tipo A — ConnectionStatusResolver (v0.14.0).
 *
 * Lógica pura sin I/O. Deriva status desde columnas DB:
 * - `paused_at` !== null → paused (gana sobre todo).
 * - OAuth + refresh expirado/ausente → needs_reauth.
 * - Resto → healthy.
 */

const NOW = new Date('2026-05-23T12:00:00Z')

function build(overrides: Partial<UserConnection> = {}): UserConnection {
  return {
    id: 'conn-1',
    userId: 'user-1',
    provider: 'square',
    externalAccountId: 'merchant-abc',
    clientId: 'client-1',
    scopeType: 'full',
    authType: 'oauth',
    email: null,
    label: null,
    scopes: 'MERCHANT_PROFILE_READ',
    accessTokenEncrypted: 'enc-access',
    refreshTokenEncrypted: 'enc-refresh',
    accessTokenExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000), // 1h
    refreshTokenExpiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000), // 30d
    credentialsEncrypted: null,
    lastRefreshedAt: null,
    pausedAt: null,
    pausedReason: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('ConnectionStatusResolver', () => {
  const resolver = new ConnectionStatusResolver()

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('paused', () => {
    it('devuelve paused cuando paused_at no es null', () => {
      const conn = build({
        pausedAt: new Date(NOW.getTime() - 1000),
        pausedReason: 'Cliente se fue de vacaciones',
      })
      expect(resolver.resolve(conn)).toEqual({
        status: 'paused',
        reason: 'Cliente se fue de vacaciones',
      })
    })

    it('devuelve paused sin reason cuando paused_reason es null', () => {
      const conn = build({ pausedAt: new Date(NOW.getTime() - 1000), pausedReason: null })
      expect(resolver.resolve(conn)).toEqual({ status: 'paused', reason: null })
    })

    it('paused gana sobre needs_reauth (prioridad)', () => {
      // OAuth con refresh expirado Y pausada → reporta paused, no needs_reauth.
      const conn = build({
        pausedAt: new Date(NOW.getTime() - 1000),
        pausedReason: null,
        refreshTokenExpiresAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      })
      expect(resolver.resolve(conn).status).toBe('paused')
    })
  })

  describe('needs_reauth (OAuth)', () => {
    it('devuelve needs_reauth cuando refresh_token_expires_at < now()', () => {
      const conn = build({
        refreshTokenExpiresAt: new Date(NOW.getTime() - 1000),
      })
      expect(resolver.resolve(conn)).toEqual({
        status: 'needs_reauth',
        reason: 'Refresh token expired',
      })
    })

    it('devuelve needs_reauth cuando refresh_token_expires_at es null', () => {
      // Square sin refresh expiry (caso raro: el provider no devolvió uno).
      const conn = build({ refreshTokenExpiresAt: null })
      expect(resolver.resolve(conn).status).toBe('needs_reauth')
    })
  })

  describe('healthy', () => {
    it('devuelve healthy cuando OAuth con refresh vigente', () => {
      const conn = build() // defaults: refresh vigente 30d, no paused
      expect(resolver.resolve(conn)).toEqual({ status: 'healthy', reason: null })
    })

    it('devuelve healthy para api_key (Clover) — sin refresh aplica', () => {
      const conn = build({
        provider: 'clover',
        authType: 'api_key',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        credentialsEncrypted: 'enc-credentials',
      })
      expect(resolver.resolve(conn)).toEqual({ status: 'healthy', reason: null })
    })
  })
})
