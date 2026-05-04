import type { Redis } from 'ioredis'
import { IntuitOauthService } from '../../../src/modules/20-intuit-oauth/oauth/intuit-oauth.service'
import type { IntuitTokensRepository } from '../../../src/modules/20-intuit-oauth/tokens/intuit-tokens.repository'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { EncryptionService } from '../../../src/core/encryption/encryption.service'
import type { IntuitOauthClientFactory } from '../../../src/modules/20-intuit-oauth/intuit-oauth-client.factory'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import { IntuitStateInvalidError } from '../../../src/modules/20-intuit-oauth/intuit-oauth.errors'
import type { AppConfigService } from '../../../src/core/config/config.service'

/**
 * Tests Tipo A para IntuitOauthService. Mocks para Redis, repos, SDK y fetch.
 *
 * Cobertura:
 * - CR-intuit-030: getAuthorizationUrlForNewClient guarda state en Redis con TTL.
 * - CR-intuit-031: getAuthorizationUrl (target) usa purpose='reauth'.
 * - CR-intuit-032: handleCallback con state válido + realm nuevo → CREATE cliente.
 * - CR-intuit-033: handleCallback con realm que YA existe → silent re-auth.
 * - CR-intuit-034: handleCallback con state inválido → IntuitStateInvalidError.
 * - CR-intuit-035: handleCallback borra state de Redis al final del flow.
 */

interface Mocks {
  redis: jest.Mocked<Pick<Redis, 'get' | 'set' | 'del'>>
  tokensRepo: jest.Mocked<IntuitTokensRepository>
  clientsRepo: jest.Mocked<ClientsRepository>
  encryption: jest.Mocked<EncryptionService>
  oauthClientFactory: jest.Mocked<IntuitOauthClientFactory>
  events: { log: jest.Mock }
  authorizeUriMock: jest.Mock
  createTokenMock: jest.Mock
  fetchMock: jest.Mock
}

function makeMocks(): Mocks {
  const authorizeUriMock = jest.fn(() => 'https://appcenter.intuit.com/oauth?state=xyz')
  const createTokenMock = jest.fn()
  const oauthClientFactory = {
    create: jest.fn(() => ({
      authorizeUri: authorizeUriMock,
      createToken: createTokenMock,
      setToken: jest.fn(),
    })),
    applyToken: jest.fn(),
  } as unknown as jest.Mocked<IntuitOauthClientFactory>

  const fetchMock = jest.fn()
  global.fetch = fetchMock

  return {
    redis: {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    },
    tokensRepo: {
      upsert: jest.fn(),
    } as unknown as jest.Mocked<IntuitTokensRepository>,
    clientsRepo: {
      findById: jest.fn(),
      findByRealmId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<ClientsRepository>,
    encryption: {
      encrypt: jest.fn((s: string) => `enc:${s}`),
    } as unknown as jest.Mocked<EncryptionService>,
    oauthClientFactory,
    events: { log: jest.fn().mockResolvedValue(undefined) },
    authorizeUriMock,
    createTokenMock,
    fetchMock,
  }
}

function buildSvc(m: Mocks): IntuitOauthService {
  const cfg = {
    intuitMinorVersion: 75,
  } as unknown as AppConfigService
  return new IntuitOauthService(
    m.redis as unknown as Redis,
    m.tokensRepo,
    m.clientsRepo,
    m.encryption,
    m.oauthClientFactory,
    cfg,
    m.events as unknown as EventLogService,
  )
}

const TOKEN_RESPONSE = {
  token: {
    access_token: 'a-tok',
    refresh_token: 'r-tok',
    expires_in: 3600,
    x_refresh_token_expires_in: 100 * 24 * 3600,
  },
}

describe('IntuitOauthService', () => {
  describe('CR-intuit-030 — getAuthorizationUrlForNewClient guarda state', () => {
    it('Redis SETEX con TTL 600s y purpose=new-client', async () => {
      const m = makeMocks()
      const svc = buildSvc(m)

      const url = await svc.getAuthorizationUrlForNewClient('user-1')

      expect(url).toBe('https://appcenter.intuit.com/oauth?state=xyz')
      expect(m.redis.set).toHaveBeenCalledTimes(1)
      const setArgs = m.redis.set.mock.calls[0]
      expect(setArgs?.[0]).toMatch(/^oauth:state:[a-f0-9]+$/)
      const payload = JSON.parse(setArgs?.[1] as string) as Record<string, unknown>
      expect(payload.purpose).toBe('new-client')
      expect(payload.user_id).toBe('user-1')
      expect(payload.client_id).toBeNull()
      expect(setArgs?.[2]).toBe('EX')
      expect(setArgs?.[3]).toBe(600)
    })
  })

  describe('CR-intuit-031 — getAuthorizationUrl (reauth target)', () => {
    it('purpose=reauth con client_id pre-asignado', async () => {
      const m = makeMocks()
      const svc = buildSvc(m)

      await svc.getAuthorizationUrl('user-1', 'client-existing')

      const setArgs = m.redis.set.mock.calls[0]
      const payload = JSON.parse(setArgs?.[1] as string) as Record<string, unknown>
      expect(payload.purpose).toBe('reauth')
      expect(payload.client_id).toBe('client-existing')
    })
  })

  describe('CR-intuit-032 — handleCallback con realm nuevo CREA cliente', () => {
    it('persiste tokens cifrados, crea cliente, emite evento', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(
        JSON.stringify({
          user_id: 'user-1',
          client_id: null,
          purpose: 'new-client',
          created_at: new Date().toISOString(),
        }),
      )
      m.createTokenMock.mockResolvedValueOnce(TOKEN_RESPONSE)
      m.fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            CompanyInfo: { Id: 'r1', CompanyName: 'Acme', LegalName: 'Acme LLC' },
          }),
      })
      m.clientsRepo.findByRealmId.mockResolvedValueOnce(null)
      m.clientsRepo.create.mockResolvedValueOnce({
        id: 'new-client-uuid',
        legalName: 'Acme LLC',
        qboRealmId: 'r1',
      } as never)

      const svc = buildSvc(m)
      const result = await svc.handleCallback('code-xyz', 'r1', 'state-1', 'https://cb?code=xyz')

      expect(result.outcome).toBe('created')
      expect(result.client_id).toBe('new-client-uuid')
      expect(m.clientsRepo.create).toHaveBeenCalledTimes(1)
      expect(m.tokensRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'new-client-uuid',
          realmId: 'r1',
          accessTokenEncrypted: 'enc:a-tok',
          refreshTokenEncrypted: 'enc:r-tok',
        }),
      )
      expect(m.events.log).toHaveBeenCalledWith(
        'intuit.client.created',
        expect.objectContaining({ realm_id: 'r1' }),
        'user-1',
        { type: 'client', id: 'new-client-uuid' },
      )
    })
  })

  describe('CR-intuit-033 — handleCallback con realm existente = silent re-auth', () => {
    it('NO crea cliente, actualiza tokens, emite reauth_silent', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(
        JSON.stringify({
          user_id: 'user-1',
          client_id: null,
          purpose: 'new-client',
          created_at: new Date().toISOString(),
        }),
      )
      m.createTokenMock.mockResolvedValueOnce(TOKEN_RESPONSE)
      m.fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            CompanyInfo: { Id: 'r1', CompanyName: 'Acme', LegalName: 'Acme LLC' },
          }),
      })
      m.clientsRepo.findByRealmId.mockResolvedValueOnce({
        id: 'existing-client',
        legalName: 'Acme LLC',
        qboRealmId: 'r1',
      } as never)

      const svc = buildSvc(m)
      const result = await svc.handleCallback('code-xyz', 'r1', 'state-1', 'https://cb?code=xyz')

      expect(result.outcome).toBe('reauth-silent')
      expect(result.client_id).toBe('existing-client')
      expect(m.clientsRepo.create).not.toHaveBeenCalled()
      expect(m.tokensRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'existing-client' }),
      )
      expect(m.events.log).toHaveBeenCalledWith(
        'intuit.client.reauth_silent',
        expect.any(Object),
        'user-1',
        expect.any(Object),
      )
    })
  })

  describe('CR-intuit-034 — IntuitStateInvalidError', () => {
    it('si Redis no tiene state, lanza', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(null)

      const svc = buildSvc(m)
      await expect(
        svc.handleCallback('c', 'r1', 'state-bad', 'https://cb?code=c'),
      ).rejects.toBeInstanceOf(IntuitStateInvalidError)
      expect(m.createTokenMock).not.toHaveBeenCalled()
    })
  })

  describe('CR-intuit-035 — borra state de Redis al final', () => {
    it('redis.del se llama tras éxito', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(
        JSON.stringify({
          user_id: 'user-1',
          client_id: null,
          purpose: 'new-client',
          created_at: new Date().toISOString(),
        }),
      )
      m.createTokenMock.mockResolvedValueOnce(TOKEN_RESPONSE)
      m.fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ CompanyInfo: { Id: 'r1', CompanyName: 'Acme', LegalName: 'Acme' } }),
      })
      m.clientsRepo.findByRealmId.mockResolvedValueOnce(null)
      m.clientsRepo.create.mockResolvedValueOnce({
        id: 'new-1',
        legalName: 'Acme',
        qboRealmId: 'r1',
      } as never)

      const svc = buildSvc(m)
      await svc.handleCallback('c', 'r1', 'state-1', 'https://cb?code=c')

      expect(m.redis.del).toHaveBeenCalledWith('oauth:state:state-1')
    })
  })
})
