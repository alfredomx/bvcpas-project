// Tests TDD-first del api wrapper de customer-support (v0.3.0, Bloque 3a).
//
// Estrategia: mock fetch con vi.stubGlobal. Validamos que el wrapper
// llama a la URL correcta, pasa los query params, y retorna el shape
// tipado.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listClientsForSidebar } from './customer-support.api'
import { ApiError } from '@/lib/http'
import type { CustomerSupportListResponse } from '../types'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleResponse: CustomerSupportListResponse = {
  period: { from: '2025-01-01', to: '2026-04-30' },
  items: [
    {
      client_id: 'c-1',
      legal_name: 'Acme LLC',
      tier: 'silver',
      qbo_realm_id: '9130350335321926',
      followup: { status: 'pending', sent_at: null },
      stats: {
        uncats_count: 0,
        amas_count: 0,
        responded_count: 0,
        progress_pct: 0,
        amount_total: '0.00',
        last_synced_at: null,
      },
      monthly: {
        previous_year_total: { uncats: 0, amas: 0 },
        by_month: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          uncats: 0,
          amas: 0,
        })),
      },
    },
  ],
}

describe('customer-support api', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listClientsForSidebar', () => {
    it('calls GET /v1/dashboards/customer-support with from/to query params', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse(200, sampleResponse)))
      vi.stubGlobal('fetch', fetchMock)

      await listClientsForSidebar({ from: '2025-01-01', to: '2026-04-30' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(
        `${TEST_BASE_URL}/v1/dashboards/customer-support?from=2025-01-01&to=2026-04-30`,
      )
      expect(init.method).toBe('GET')
    })

    it('returns the typed response from a 200', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse(200, sampleResponse)))
      vi.stubGlobal('fetch', fetchMock)

      const result = await listClientsForSidebar({ from: '2025-01-01', to: '2026-04-30' })

      expect(result).toEqual(sampleResponse)
      expect(result.items[0].stats.uncats_count).toBe(0)
      expect(result.items[0].followup.status).toBe('pending')
    })

    it('throws ApiError on non-2xx response', async () => {
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(401, {
            statusCode: 401,
            code: 'SESSION_EXPIRED',
            message: 'expired',
          }),
        ),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        listClientsForSidebar({ from: '2025-01-01', to: '2026-04-30' }),
      ).rejects.toBeInstanceOf(ApiError)
    })
  })
})
