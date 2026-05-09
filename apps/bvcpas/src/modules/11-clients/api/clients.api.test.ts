// Tests del wrapper sobre `GET /v1/clients` usando el SDK tipado
// (`@/lib/api/client`). v0.4.0, Bloque 1.
//
// Estrategia:
//   - vi.stubEnv('NEXT_PUBLIC_API_URL', ...) ANTES del import dinámico
//     porque createClient lee el env al construirse.
//   - vi.stubGlobal('fetch', vi.fn(...)) por test.
//   - vi.resetModules() entre tests para que cada uno reciba un
//     cliente fresco.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleResponse = {
  items: [
    {
      id: 'c-1',
      legal_name: 'Acme LLC',
      dba: null,
      qbo_realm_id: '9000',
      industry: null,
      entity_type: null,
      fiscal_year_start: null,
      timezone: null,
      status: 'active',
      tier: 'silver',
      primary_contact_name: null,
      primary_contact_email: null,
      notes: null,
      metadata: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 50,
}

async function importApi(): Promise<typeof import('./clients.api')> {
  return await import('./clients.api')
}

describe('clients.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listClients', () => {
    it('calls GET /v1/clients and returns the typed response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { listClients } = await importApi()
      const result = await listClients()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(`${TEST_BASE_URL}/v1/clients`)
      expect(calledRequest.method).toBe('GET')
      expect(result).toEqual(sampleResponse)
      expect(result.items[0].id).toBe('c-1')
    })

    it('throws when the response is not 2xx', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(500, { statusCode: 500, code: 'INTERNAL', message: 'boom' }))
      vi.stubGlobal('fetch', fetchMock)

      const { listClients } = await importApi()
      await expect(listClients()).rejects.toBeDefined()
    })
  })
})
