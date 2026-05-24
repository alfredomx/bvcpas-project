// Tests del wrapper sobre los endpoints de integrations (v0.1.0).
//
// Estrategia espejo de `11-clients/api/clients.api.test.ts`:
//   - vi.stubEnv('NEXT_PUBLIC_API_URL', ...) antes del import dinámico
//     porque createClient lee el env al construirse.
//   - vi.stubGlobal('fetch', ...) por test.
//   - vi.resetModules() entre tests para cliente fresco.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 })
}

const sampleDashboard = {
  client: { id: 'c-1', legalName: 'Acme LLC' },
  stats: {
    connected: 2,
    healthy: 1,
    needsAttention: 1,
    errors: 0,
    providersInUse: 2,
  },
  connections: [
    {
      id: 'conn-1',
      provider: 'clover',
      providerLabel: 'Clover',
      label: 'Blanco To Go',
      externalAccountId: 'MQZZH123',
      authType: 'api_key',
      status: 'healthy',
      statusReason: null,
      pausedAt: null,
      pausedReason: null,
      lastSyncAt: '2026-05-22T14:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'conn-2',
      provider: 'square',
      providerLabel: 'Square',
      label: null,
      externalAccountId: 'LOC123',
      authType: 'oauth',
      status: 'needs_reauth',
      statusReason: 'token expired',
      pausedAt: null,
      pausedReason: null,
      lastSyncAt: null,
      createdAt: '2026-04-15T00:00:00.000Z',
    },
  ],
}

async function importApi(): Promise<typeof import('./integrations.api')> {
  return await import('./integrations.api')
}

describe('integrations.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('getClientIntegrations', () => {
    it('calls GET /v1/clients/:id/integrations and returns parsed body', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, sampleDashboard))
      vi.stubGlobal('fetch', fetchMock)

      const { getClientIntegrations } = await importApi()
      const result = await getClientIntegrations('c-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/clients/c-1/integrations`,
      )
      expect(calledRequest.method).toBe('GET')
      expect(result.client.id).toBe('c-1')
      expect(result.connections).toHaveLength(2)
      expect(result.stats.connected).toBe(2)
    })

    it('throws on non-2xx response', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(404, { statusCode: 404, code: 'NOT_FOUND' }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { getClientIntegrations } = await importApi()
      await expect(getClientIntegrations('missing')).rejects.toBeDefined()
    })
  })

  describe('pauseConnection', () => {
    it('POSTs /v1/connections/:id/pause with reason in body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(noContentResponse())
      vi.stubGlobal('fetch', fetchMock)

      const { pauseConnection } = await importApi()
      await pauseConnection('conn-1', 'client on vacation')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/connections/conn-1/pause`,
      )
      expect(calledRequest.method).toBe('POST')
      const sentBody = await calledRequest.text()
      expect(JSON.parse(sentBody)).toEqual({ reason: 'client on vacation' })
    })

    it('POSTs with empty body when reason is omitted', async () => {
      const fetchMock = vi.fn().mockResolvedValue(noContentResponse())
      vi.stubGlobal('fetch', fetchMock)

      const { pauseConnection } = await importApi()
      await pauseConnection('conn-1')

      const [calledRequest] = fetchMock.mock.calls[0]
      const sentBody = await calledRequest.text()
      expect(JSON.parse(sentBody)).toEqual({})
    })

    it('throws on 409 (already paused)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(409, { statusCode: 409, code: 'ALREADY_PAUSED' }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { pauseConnection } = await importApi()
      await expect(pauseConnection('conn-1')).rejects.toBeDefined()
    })
  })

  describe('resumeConnection', () => {
    it('POSTs /v1/connections/:id/resume with no body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(noContentResponse())
      vi.stubGlobal('fetch', fetchMock)

      const { resumeConnection } = await importApi()
      await resumeConnection('conn-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/connections/conn-1/resume`,
      )
      expect(calledRequest.method).toBe('POST')
    })

    it('throws on 409 (not paused)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(409, { statusCode: 409, code: 'NOT_PAUSED' }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { resumeConnection } = await importApi()
      await expect(resumeConnection('conn-1')).rejects.toBeDefined()
    })
  })

  describe('testConnection', () => {
    it('POSTs /v1/connections/:id/test and returns {ok, message}', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { ok: true, message: 'All good' }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { testConnection } = await importApi()
      const result = await testConnection('conn-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/connections/conn-1/test`,
      )
      expect(calledRequest.method).toBe('POST')
      expect(result).toEqual({ ok: true, message: 'All good' })
    })

    it('throws on non-2xx', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(401, { statusCode: 401, code: 'INVALID_TOKEN' }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { testConnection } = await importApi()
      await expect(testConnection('conn-1')).rejects.toBeDefined()
    })
  })
})
