// Tests del wrapper sobre `GET /v1/clients/:id/uncats` (v0.5.0, Bloque B).
// Vive en 13-dashboards porque es view (D-bvcpas-026).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleResponse = {
  period: { from: '2025-01-01', to: '2026-04-30' },
  client: {
    id: 'c-1',
    legal_name: 'Acme LLC',
    tier: 'silver',
    qbo_realm_id: '9000',
    primary_contact_name: 'Jane',
    primary_contact_email: 'jane@acme.com',
    transactions_filter: 'all',
    draft_email_enabled: true,
    cc_email: null,
  },
  followup: {
    status: 'awaiting_reply',
    sent_at: '2026-04-13T10:00:00.000Z',
    last_reply_at: null,
    internal_notes: null,
  },
  stats: {
    uncats_count: 26,
    amas_count: 4,
    responded_count: 0,
    progress_pct: 0,
    amount_total: '62600.00',
    last_synced_at: '2026-04-30T23:59:00.000Z',
    silent_streak_days: 95,
  },
  monthly: {
    previous_year_total: { uncats: 1, amas: 0 },
    by_month: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      uncats: 0,
      amas: 0,
    })),
  },
}

async function importApi(): Promise<typeof import('./uncats-detail.api')> {
  return await import('./uncats-detail.api')
}

describe('uncats-detail api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('calls GET /v1/clients/:id/uncats with from and to query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse))
    vi.stubGlobal('fetch', fetchMock)

    const { getUncatsDetail } = await importApi()
    const result = await getUncatsDetail('c-1', { from: '2025-01-01', to: '2026-04-30' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledRequest] = fetchMock.mock.calls[0]
    const url = new URL(calledRequest.url)
    expect(url.pathname).toBe('/v1/clients/c-1/uncats')
    expect(url.searchParams.get('from')).toBe('2025-01-01')
    expect(url.searchParams.get('to')).toBe('2026-04-30')
    expect(calledRequest.method).toBe('GET')
    expect(result).toEqual(sampleResponse)
  })

  it('throws when the response is not 2xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { statusCode: 404, code: 'NOT_FOUND' }))
    vi.stubGlobal('fetch', fetchMock)

    const { getUncatsDetail } = await importApi()
    await expect(
      getUncatsDetail('c-x', { from: '2025-01-01', to: '2026-04-30' }),
    ).rejects.toBeDefined()
  })
})
