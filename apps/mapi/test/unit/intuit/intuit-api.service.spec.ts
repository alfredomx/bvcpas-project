import { IntuitApiService } from '../../../src/modules/20-intuit-oauth/api-client/intuit-api.service'
import type { ConnectionTokenRefreshService } from '../../../src/modules/21-connections/connection-token-refresh.service'
import type { AppConfigService } from '../../../src/core/config/config.service'
import type { MetricsService } from '../../../src/core/metrics/metrics.service'
import { IntuitBadRequestError } from '../../../src/modules/20-intuit-oauth/intuit-oauth.errors'

/**
 * Tests Tipo A para IntuitApiService. Mockea fetch global, sin red real.
 *
 * v0.8.0: ahora consume ConnectionTokenRefreshService en vez de
 * IntuitTokensService. GET usa read-priority (fallback a global readonly);
 * POST/PUT/DELETE requiere personal full del user.
 *
 * Cobertura:
 * - CR-intuit-020: call() construye URL con minorversion + Authorization.
 * - CR-intuit-021: call() para GET usa getValidAccessTokenForClientRead.
 * - CR-intuit-022: call() para POST usa getValidAccessTokenForClientWrite.
 * - CR-intuit-023: call() lanza IntuitBadRequestError en 4xx con qboErrors.
 * - CR-intuit-024: call() retry-on-401: re-resuelve token + reintenta UNA vez.
 * - CR-intuit-025: call() incrementa intuitApiCallsTotal con path normalizado.
 */

interface Mocks {
  tokens: jest.Mocked<ConnectionTokenRefreshService>
  cfg: AppConfigService
  metrics: MetricsService
  incMock: jest.Mock
  fetchMock: jest.Mock
}

function makeMocks(): Mocks {
  const tokens = {
    getValidAccessTokenForClientRead: jest.fn(),
    getValidAccessTokenForClientWrite: jest.fn(),
  } as unknown as jest.Mocked<ConnectionTokenRefreshService>

  const cfg = {
    intuitEnvironment: 'production',
    intuitMinorVersion: 75,
  } as unknown as AppConfigService

  const incMock = jest.fn()
  const metrics = {
    intuitApiCallsTotal: { inc: incMock },
  } as unknown as MetricsService

  const fetchMock = jest.fn()
  global.fetch = fetchMock

  return { tokens, cfg, metrics, incMock, fetchMock }
}

function buildSvc(m: Mocks): IntuitApiService {
  return new IntuitApiService(m.tokens, m.cfg, m.metrics)
}

describe('IntuitApiService', () => {
  describe('CR-intuit-020 — URL + Authorization', () => {
    it('construye URL con minorversion y header Bearer', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientRead.mockResolvedValueOnce('access-1')
      m.fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      const svc = buildSvc(m)

      await svc.call({
        clientId: 'client-1',
        userId: 'user-1',
        method: 'GET',
        path: '/company/r1/companyinfo/r1',
      })

      const [url, init] = m.fetchMock.mock.calls[0] ?? []
      expect(url).toBe(
        'https://quickbooks.api.intuit.com/v3/company/r1/companyinfo/r1?minorversion=75',
      )
      expect((init as RequestInit).method).toBe('GET')
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer access-1',
        Accept: 'application/json',
      })
    })
  })

  describe('CR-intuit-021 — GET usa read-priority', () => {
    it('llama getValidAccessTokenForClientRead', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientRead.mockResolvedValueOnce('access-r')
      m.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      const svc = buildSvc(m)

      await svc.call({
        clientId: 'client-1',
        userId: 'user-1',
        method: 'GET',
        path: '/x',
      })

      expect(m.tokens.getValidAccessTokenForClientRead).toHaveBeenCalledWith(
        'intuit',
        'client-1',
        'user-1',
      )
      expect(m.tokens.getValidAccessTokenForClientWrite).not.toHaveBeenCalled()
    })
  })

  describe('CR-intuit-022 — POST/PUT/DELETE requieren personal full', () => {
    it('POST llama getValidAccessTokenForClientWrite', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientWrite.mockResolvedValueOnce('access-w')
      m.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      const svc = buildSvc(m)

      await svc.call({
        clientId: 'client-1',
        userId: 'user-1',
        method: 'POST',
        path: '/x',
        body: { foo: 'bar' },
      })

      expect(m.tokens.getValidAccessTokenForClientWrite).toHaveBeenCalledWith(
        'intuit',
        'client-1',
        'user-1',
      )
      expect(m.tokens.getValidAccessTokenForClientRead).not.toHaveBeenCalled()
    })

    it('Content-Type se agrega cuando hay body', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientWrite.mockResolvedValueOnce('access-w')
      m.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      const svc = buildSvc(m)

      await svc.call({
        clientId: 'c',
        userId: 'u',
        method: 'POST',
        path: '/x',
        body: { foo: 'bar' },
      })

      const init = m.fetchMock.mock.calls[0]?.[1] as RequestInit
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
      expect(init.body).toBe(JSON.stringify({ foo: 'bar' }))
    })
  })

  describe('CR-intuit-023 — 4xx lanza IntuitBadRequestError', () => {
    it('agrega status y body al error', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientRead.mockResolvedValueOnce('access-1')
      m.fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid query',
      })
      const svc = buildSvc(m)

      await expect(
        svc.call({ clientId: 'c', userId: 'u', method: 'GET', path: '/x' }),
      ).rejects.toBeInstanceOf(IntuitBadRequestError)
    })
  })

  describe('CR-intuit-024 — retry-on-401', () => {
    it('en 401 re-resuelve token y reintenta UNA vez', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientRead
        .mockResolvedValueOnce('access-old')
        .mockResolvedValueOnce('access-fresh')
      m.fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'unauthorized',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
        })
      const svc = buildSvc(m)

      const result = await svc.call({
        clientId: 'c',
        userId: 'u',
        method: 'GET',
        path: '/x',
      })

      expect(result).toEqual({ ok: true })
      expect(m.tokens.getValidAccessTokenForClientRead).toHaveBeenCalledTimes(2)
      expect(m.fetchMock).toHaveBeenCalledTimes(2)
    })

    it('si el reintento también falla 401, propaga el error sin loop', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientRead
        .mockResolvedValueOnce('a1')
        .mockResolvedValueOnce('a2')
      m.fetchMock
        .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'x' })
        .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'x' })
      const svc = buildSvc(m)

      await expect(
        svc.call({ clientId: 'c', userId: 'u', method: 'GET', path: '/x' }),
      ).rejects.toBeInstanceOf(IntuitBadRequestError)
      expect(m.fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('CR-intuit-025 — métricas', () => {
    it('incrementa intuitApiCallsTotal con path normalizado y status', async () => {
      const m = makeMocks()
      m.tokens.getValidAccessTokenForClientRead.mockResolvedValueOnce('a')
      m.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      const svc = buildSvc(m)

      await svc.call({
        clientId: 'c',
        userId: 'u',
        method: 'GET',
        path: '/company/9341454027303089/companyinfo/9341454027303089',
      })

      expect(m.incMock).toHaveBeenCalledWith({
        path: '/company/:realm/companyinfo/:realm',
        status: '200',
      })
    })
  })
})
