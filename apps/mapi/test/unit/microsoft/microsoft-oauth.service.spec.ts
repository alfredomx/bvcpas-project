import type Redis from 'ioredis'
import { MicrosoftOauthService } from '../../../src/modules/21-microsoft-oauth/oauth/microsoft-oauth.service'
import type { MicrosoftTokensService } from '../../../src/modules/21-microsoft-oauth/tokens/microsoft-tokens.service'
import type { AppConfigService } from '../../../src/core/config/config.service'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import {
  MicrosoftAuthError,
  MicrosoftStateInvalidError,
} from '../../../src/modules/21-microsoft-oauth/microsoft-oauth.errors'

/**
 * Tests Tipo A para MicrosoftOauthService.
 *
 * Cobertura:
 * - CR-msft-008: buildAuthorizationUrl arma URL con scopes correctos.
 * - CR-msft-009: state guardado en Redis con prefix oauth:state:msft: y TTL 600s.
 * - CR-msft-010: handleCallback con state inexistente → MicrosoftStateInvalidError.
 * - CR-msft-011: handleCallback con code válido persiste tokens, llama Graph /me, emite evento.
 * - CR-msft-012: handleCallback con error de Microsoft en exchange → MicrosoftAuthError.
 */

interface Mocks {
  redis: jest.Mocked<Redis>
  tokens: jest.Mocked<MicrosoftTokensService>
  cfg: AppConfigService
  events: { log: jest.Mock }
  fetchFn: jest.Mock
}

function makeMocks(): Mocks {
  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
  } as unknown as jest.Mocked<Redis>

  const tokens = {
    upsert: jest.fn(),
    getDecryptedByUserId: jest.fn(),
    deleteByUserId: jest.fn(),
  } as unknown as jest.Mocked<MicrosoftTokensService>

  const cfg = {
    microsoftClientId: 'msft-client-id',
    microsoftClientSecret: 'msft-secret',
    microsoftRedirectUri: 'https://dev.alfredo.mx/v1/microsoft-oauth/callback',
  } as unknown as AppConfigService

  return {
    redis,
    tokens,
    cfg,
    events: { log: jest.fn() },
    fetchFn: jest.fn(),
  }
}

function buildService(m: Mocks): MicrosoftOauthService {
  return new MicrosoftOauthService(
    m.redis,
    m.tokens,
    m.cfg,
    m.events as unknown as EventLogService,
    m.fetchFn,
  )
}

describe('MicrosoftOauthService', () => {
  describe('CR-msft-008 — buildAuthorizationUrl arma URL correcta', () => {
    it('incluye client_id, redirect_uri, scopes, state, prompt=consent', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      const url = await svc.buildAuthorizationUrl('user-1')
      const parsed = new URL(url)

      expect(parsed.origin + parsed.pathname).toBe(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      )
      expect(parsed.searchParams.get('client_id')).toBe('msft-client-id')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://dev.alfredo.mx/v1/microsoft-oauth/callback',
      )
      expect(parsed.searchParams.get('response_mode')).toBe('query')
      expect(parsed.searchParams.get('scope')).toBe('Mail.Send User.Read offline_access')
      expect(parsed.searchParams.get('prompt')).toBe('consent')
      const state = parsed.searchParams.get('state')
      expect(state).toMatch(/^[a-f0-9]{48}$/)
    })
  })

  describe('CR-msft-009 — state guardado en Redis', () => {
    it('usa prefix oauth:state:msft: y TTL 600s', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      const url = await svc.buildAuthorizationUrl('user-1')
      const state = new URL(url).searchParams.get('state')

      expect(m.redis.set).toHaveBeenCalledTimes(1)
      const [key, value, exFlag, ttl] = m.redis.set.mock.calls[0] ?? []
      expect(key).toBe(`oauth:state:msft:${state}`)
      expect(exFlag).toBe('EX')
      expect(ttl).toBe(600)

      const payload = JSON.parse(value as string) as { user_id: string }
      expect(payload.user_id).toBe('user-1')
    })
  })

  describe('CR-msft-010 — state inexistente en callback', () => {
    it('lanza MicrosoftStateInvalidError', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.handleCallback('any-code', 'unknown-state')).rejects.toBeInstanceOf(
        MicrosoftStateInvalidError,
      )
    })
  })

  describe('CR-msft-011 — callback exitoso', () => {
    it('intercambia code, llama Graph /me, persiste tokens, borra state, emite evento', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(
        JSON.stringify({ user_id: 'user-1', created_at: '2026-05-05T12:00:00Z' }),
      )
      // 1: token exchange. 2: Graph /me
      m.fetchFn
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'access-from-callback',
            refresh_token: 'refresh-from-callback',
            expires_in: 3600,
            scope: 'Mail.Send User.Read offline_access',
            token_type: 'Bearer',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'msft-uid-abc',
            mail: 'bob@example.com',
            userPrincipalName: 'bob@example.com',
            displayName: 'Bob',
          }),
        })

      const svc = buildService(m)
      const result = await svc.handleCallback('code-xyz', 'state-xyz')

      expect(result).toEqual({ email: 'bob@example.com', microsoftUserId: 'msft-uid-abc' })

      // exchange call
      const [exchangeUrl, exchangeInit] = m.fetchFn.mock.calls[0] ?? []
      expect(exchangeUrl).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
      const params = new URLSearchParams(exchangeInit?.body as string)
      expect(params.get('grant_type')).toBe('authorization_code')
      expect(params.get('code')).toBe('code-xyz')
      expect(params.get('redirect_uri')).toBe('https://dev.alfredo.mx/v1/microsoft-oauth/callback')

      // graph /me call
      const [meUrl, meInit] = m.fetchFn.mock.calls[1] ?? []
      expect(meUrl).toBe('https://graph.microsoft.com/v1.0/me')
      expect(meInit?.headers).toMatchObject({
        Authorization: 'Bearer access-from-callback',
      })

      // upsert
      expect(m.tokens.upsert).toHaveBeenCalledTimes(1)
      const saved = m.tokens.upsert.mock.calls[0]?.[0]
      expect(saved).toMatchObject({
        userId: 'user-1',
        microsoftUserId: 'msft-uid-abc',
        email: 'bob@example.com',
        accessToken: 'access-from-callback',
        refreshToken: 'refresh-from-callback',
        scopes: 'Mail.Send User.Read offline_access',
      })

      // state borrado
      expect(m.redis.del).toHaveBeenCalledWith('oauth:state:msft:state-xyz')

      // evento
      expect(m.events.log).toHaveBeenCalledWith(
        'microsoft.connected',
        expect.objectContaining({ email: 'bob@example.com' }),
        'user-1',
        expect.anything(),
      )
    })
  })

  describe('CR-msft-012 — exchange falla', () => {
    it('lanza MicrosoftAuthError si Microsoft devuelve error en exchange', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(JSON.stringify({ user_id: 'user-1' }))
      m.fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'AADSTS9002313: code expired',
        }),
      })

      const svc = buildService(m)
      await expect(svc.handleCallback('expired-code', 'state-xyz')).rejects.toBeInstanceOf(
        MicrosoftAuthError,
      )
    })
  })
})
