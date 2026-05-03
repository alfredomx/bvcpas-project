import { IntuitApiService } from '../../../src/modules/20-intuit-oauth/api-client/intuit-api.service'
import type { IntuitTokensService } from '../../../src/modules/20-intuit-oauth/tokens/intuit-tokens.service'
import type { AppConfigService } from '../../../src/core/config/config.service'
import type { MetricsService } from '../../../src/core/metrics/metrics.service'
import { IntuitBadRequestError } from '../../../src/modules/20-intuit-oauth/intuit-oauth.errors'
import type { DecryptedIntuitToken } from '../../../src/db/schema/intuit-tokens'

/**
 * Tests Tipo A para IntuitApiService. Mockea fetch global, sin red real.
 *
 * Cobertura:
 * - CR-intuit-020: call() construye URL con env=production + minorversion.
 * - CR-intuit-021: call() agrega Authorization Bearer y Content-Type al body.
 * - CR-intuit-022: call() retorna JSON parseado en 2xx.
 * - CR-intuit-023: call() lanza IntuitBadRequestError en 4xx con qboErrors.
 * - CR-intuit-024: call() retry-on-401: forceRefresh + reintenta UNA vez.
 * - CR-intuit-025: call() incrementa intuitApiCallsTotal con path normalizado.
 */

function buildToken(overrides: Partial<DecryptedIntuitToken> = {}): DecryptedIntuitToken {
  return {
    clientId: 'client-123',
    realmId: 'realm-9341454027303089',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 3600 * 1000),
    ...overrides,
  }
}

interface Mocks {
  tokens: jest.Mocked<IntuitTokensService>
  cfg: AppConfigService
  metrics: MetricsService
  incMock: jest.Mock
  fetchMock: jest.Mock
}

function makeMocks(): Mocks {
  const tokens = {
    getValidTokens: jest.fn(),
    forceRefresh: jest.fn(),
  } as unknown as jest.Mocked<IntuitTokensService>

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

describe('IntuitApiService', () => {
  describe('CR-intuit-020 — URL con env=production + minorversion', () => {
    it('construye URL con base prod + minorversion=75', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await svc.call({ clientId: 'client-123', method: 'GET', path: '/company/r1/account/1' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toBe('https://quickbooks.api.intuit.com/v3/company/r1/account/1?minorversion=75')
    })

    it('preserva query string existente y agrega minorversion con &', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await svc.call({
        clientId: 'client-123',
        method: 'GET',
        path: '/company/r1/query?query=SELECT * FROM Account',
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain('?query=SELECT * FROM Account&minorversion=75')
    })
  })

  describe('CR-intuit-021 — headers Authorization + Content-Type', () => {
    it('GET sin body NO incluye Content-Type', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await svc.call({ clientId: 'client-123', method: 'GET', path: '/company/r1/x' })

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer access-1')
      expect(headers.Accept).toBe('application/json')
      expect(headers['Content-Type']).toBeUndefined()
    })

    it('POST con body incluye Content-Type application/json y serializa body', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await svc.call({
        clientId: 'client-123',
        method: 'POST',
        path: '/company/r1/vendor',
        body: { Name: 'Acme' },
      })

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit
      const headers = init.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      expect(init.body).toBe(JSON.stringify({ Name: 'Acme' }))
    })
  })

  describe('CR-intuit-022 — retorna JSON parseado en 2xx', () => {
    it('retorna body JSON tal cual', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ QueryResponse: { Account: [{ Id: '1' }] } }),
      })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      const result = await svc.call({
        clientId: 'client-123',
        method: 'GET',
        path: '/company/r1/account',
      })

      expect(result).toEqual({ QueryResponse: { Account: [{ Id: '1' }] } })
    })
  })

  describe('CR-intuit-023 — IntuitBadRequestError en 4xx', () => {
    it('400 lanza IntuitBadRequestError con qboErrors.status', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"Fault":{"Error":[]}}'),
      })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await expect(
        svc.call({ clientId: 'client-123', method: 'GET', path: '/company/r1/x' }),
      ).rejects.toBeInstanceOf(IntuitBadRequestError)
    })
  })

  describe('CR-intuit-024 — retry-on-401', () => {
    it('en 401: forceRefresh, reintenta UNA vez con nuevo token y resuelve si OK', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      tokens.forceRefresh.mockResolvedValueOnce(buildToken({ accessToken: 'access-2' }))
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve('{"error":"unauthorized"}'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      const result = await svc.call({
        clientId: 'client-123',
        method: 'GET',
        path: '/company/r1/x',
      })

      expect(result).toEqual({ ok: true })
      expect(tokens.forceRefresh).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit
      expect((secondInit.headers as Record<string, string>).Authorization).toBe('Bearer access-2')
    })

    it('si segundo intento también falla con 401, propaga el error sin tercer retry', async () => {
      const { tokens, cfg, metrics, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      tokens.forceRefresh.mockResolvedValueOnce(buildToken({ accessToken: 'access-2' }))
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve('{}'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve('{}'),
        })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await expect(
        svc.call({ clientId: 'client-123', method: 'GET', path: '/company/r1/x' }),
      ).rejects.toBeInstanceOf(IntuitBadRequestError)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('CR-intuit-025 — métrica con path normalizado', () => {
    it('inc({path normalizado, status}) con realmId reemplazado a :realm', async () => {
      const { tokens, cfg, metrics, incMock, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await svc.call({
        clientId: 'client-123',
        method: 'GET',
        path: '/company/9341454027303089/companyinfo/9341454027303089',
      })

      expect(incMock).toHaveBeenCalledWith({
        path: '/company/:realm/companyinfo/:realm',
        status: '200',
      })
    })

    it('inc con status="error" en 4xx', async () => {
      const { tokens, cfg, metrics, incMock, fetchMock } = makeMocks()
      tokens.getValidTokens.mockResolvedValueOnce(buildToken())
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{}'),
      })

      const svc = new IntuitApiService(tokens, cfg, metrics)
      await expect(
        svc.call({ clientId: 'client-123', method: 'GET', path: '/company/r1/x' }),
      ).rejects.toBeDefined()

      expect(incMock).toHaveBeenCalledWith(expect.objectContaining({ status: '400' }))
    })
  })
})
