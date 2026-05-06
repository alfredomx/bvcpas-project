import type Redis from 'ioredis'
import { MicrosoftConnectionService } from '../../../../src/modules/21-connections/providers/microsoft/microsoft.service'
import type { ConnectionsService } from '../../../../src/modules/21-connections/connections.service'
import type { AppConfigService } from '../../../../src/core/config/config.service'
import type { EventLogService } from '../../../../src/modules/95-event-log/event-log.service'
import {
  ConnectionAuthError,
  ConnectionStateInvalidError,
} from '../../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para MicrosoftConnectionService (OAuth flow).
 *
 * Cobertura:
 * - CR-conn-011: buildAuthorizationUrl arma URL con scopes + state + prompt=consent.
 * - CR-conn-012: state guardado en Redis con prefix oauth:state:msft: y TTL 600s.
 * - CR-conn-013: handleCallback con state inválido → ConnectionStateInvalidError.
 * - CR-conn-014: callback exitoso: exchange + Graph /me + UPSERT con provider='microsoft'.
 *
 * También cubrimos error de exchange: ConnectionAuthError.
 */

interface Mocks {
  redis: jest.Mocked<Redis>
  connections: jest.Mocked<ConnectionsService>
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

  const connections = {
    upsert: jest.fn().mockResolvedValue({ id: 'conn-fake', userId: 'user-1' }),
  } as unknown as jest.Mocked<ConnectionsService>

  const cfg = {
    microsoftClientId: 'msft-client-id',
    microsoftClientSecret: 'msft-secret',
    microsoftRedirectUri: 'https://dev.alfredo.mx/v1/connections/microsoft/callback',
  } as unknown as AppConfigService

  return {
    redis,
    connections,
    cfg,
    events: { log: jest.fn() },
    fetchFn: jest.fn(),
  }
}

function buildService(m: Mocks): MicrosoftConnectionService {
  return new MicrosoftConnectionService(
    m.redis,
    m.connections,
    m.cfg,
    m.events as unknown as EventLogService,
    m.fetchFn,
  )
}

describe('MicrosoftConnectionService', () => {
  describe('CR-conn-011 — buildAuthorizationUrl arma URL correcta', () => {
    it('incluye client_id, redirect_uri, scopes, state, prompt=consent', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      const url = await svc.buildAuthorizationUrl('user-1', 'Mi cuenta personal')
      const parsed = new URL(url)

      expect(parsed.origin + parsed.pathname).toBe(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      )
      expect(parsed.searchParams.get('client_id')).toBe('msft-client-id')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://dev.alfredo.mx/v1/connections/microsoft/callback',
      )
      expect(parsed.searchParams.get('response_mode')).toBe('query')
      expect(parsed.searchParams.get('scope')).toBe('Mail.Send User.Read offline_access')
      expect(parsed.searchParams.get('prompt')).toBe('consent')
      const state = parsed.searchParams.get('state')
      expect(state).toMatch(/^[a-f0-9]{48}$/)
    })
  })

  describe('CR-conn-012 — state guardado en Redis', () => {
    it('usa prefix oauth:state:msft: y TTL 600s, payload con user_id + label', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      const url = await svc.buildAuthorizationUrl('user-1', 'Cuenta clientes')
      const state = new URL(url).searchParams.get('state')

      expect(m.redis.set).toHaveBeenCalledTimes(1)
      const [key, value, exFlag, ttl] = m.redis.set.mock.calls[0] ?? []
      expect(key).toBe(`oauth:state:msft:${state}`)
      expect(exFlag).toBe('EX')
      expect(ttl).toBe(600)

      const payload = JSON.parse(value as string) as { user_id: string; label: string | null }
      expect(payload.user_id).toBe('user-1')
      expect(payload.label).toBe('Cuenta clientes')
    })

    it('label undefined se guarda como null en payload', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      await svc.buildAuthorizationUrl('user-1')

      const [, value] = m.redis.set.mock.calls[0] ?? []
      const payload = JSON.parse(value as string) as { label: string | null }
      expect(payload.label).toBeNull()
    })
  })

  describe('CR-conn-013 — state inválido', () => {
    it('lanza ConnectionStateInvalidError', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.handleCallback('any-code', 'unknown-state')).rejects.toBeInstanceOf(
        ConnectionStateInvalidError,
      )
    })
  })

  describe('CR-conn-014 — callback exitoso', () => {
    it('intercambia code, llama Graph /me, UPSERT con provider=microsoft, borra state, emite evento', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(
        JSON.stringify({
          user_id: 'user-1',
          label: 'Mi cuenta personal',
          created_at: '2026-05-06T12:00:00Z',
        }),
      )
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

      expect(result).toEqual({
        email: 'bob@example.com',
        externalAccountId: 'msft-uid-abc',
        label: 'Mi cuenta personal',
      })

      // exchange
      const [exchangeUrl, exchangeInit] = m.fetchFn.mock.calls[0] ?? []
      expect(exchangeUrl).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
      const params = new URLSearchParams(exchangeInit?.body as string)
      expect(params.get('grant_type')).toBe('authorization_code')
      expect(params.get('code')).toBe('code-xyz')

      // graph /me
      const [meUrl, meInit] = m.fetchFn.mock.calls[1] ?? []
      expect(meUrl).toBe('https://graph.microsoft.com/v1.0/me')
      expect(meInit?.headers).toMatchObject({ Authorization: 'Bearer access-from-callback' })

      // upsert con provider='microsoft'
      expect(m.connections.upsert).toHaveBeenCalledTimes(1)
      const saved = m.connections.upsert.mock.calls[0]?.[0]
      expect(saved).toMatchObject({
        userId: 'user-1',
        provider: 'microsoft',
        externalAccountId: 'msft-uid-abc',
        email: 'bob@example.com',
        label: 'Mi cuenta personal',
        scopes: 'Mail.Send User.Read offline_access',
        accessToken: 'access-from-callback',
        refreshToken: 'refresh-from-callback',
      })

      // state borrado
      expect(m.redis.del).toHaveBeenCalledWith('oauth:state:msft:state-xyz')

      // evento
      expect(m.events.log).toHaveBeenCalledWith(
        'connection.created',
        expect.objectContaining({ provider: 'microsoft', email: 'bob@example.com' }),
        'user-1',
        expect.anything(),
      )
    })

    it('exchange falla → ConnectionAuthError', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(JSON.stringify({ user_id: 'user-1', label: null }))
      m.fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', error_description: 'code expired' }),
      })

      const svc = buildService(m)
      await expect(svc.handleCallback('expired-code', 'state-xyz')).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })
})
