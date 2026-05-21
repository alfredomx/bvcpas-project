// Tests del wrapper público (v0.8.0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'
const TOKEN = 'dc36b46e1249bf61c007967ec7c0a4a1ba59e449cea241a1050bf4f51c0685d9'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleListResponse = {
  client: {
    id: 'c-1',
    legal_name: 'Test LLC',
    transactions_filter: 'expense',
  },
  items: [],
  total: 0,
}

async function importApi(): Promise<typeof import('./public-uncats.api')> {
  return await import('./public-uncats.api')
}

describe('public-uncats.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('getPublicUncats', () => {
    it('GETs /v1/public/uncats/:token without Authorization header', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleListResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { getPublicUncats } = await importApi()
      const result = await getPublicUncats(TOKEN)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(`${TEST_BASE_URL}/v1/public/uncats/${TOKEN}`)
      expect(init.method).toBe('GET')
      expect(init.headers).toBeUndefined()
      expect(result).toEqual(sampleListResponse)
    })

    it('throws ApiError with code on 404', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(404, {
            statusCode: 404,
            code: 'PUBLIC_LINK_NOT_FOUND',
            message: 'Public link not found.',
          }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { getPublicUncats } = await importApi()
      try {
        await getPublicUncats(TOKEN)
        throw new Error('Expected to throw')
      } catch (err) {
        const apiErr = err as { statusCode: number; code: string }
        expect(apiErr.statusCode).toBe(404)
        expect(apiErr.code).toBe('PUBLIC_LINK_NOT_FOUND')
      }
    })

    it('throws ApiError with PUBLIC_LINK_REVOKED on 410', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(410, {
            statusCode: 410,
            code: 'PUBLIC_LINK_REVOKED',
            message: 'This link is no longer active.',
          }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { getPublicUncats } = await importApi()
      try {
        await getPublicUncats(TOKEN)
        throw new Error('Expected to throw')
      } catch (err) {
        const apiErr = err as { statusCode: number; code: string }
        expect(apiErr.statusCode).toBe(410)
        expect(apiErr.code).toBe('PUBLIC_LINK_REVOKED')
      }
    })
  })

  describe('savePublicNote', () => {
    it('PATCHes /v1/public/uncats/:token/:txnId with note body and no auth', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)

      const { savePublicNote } = await importApi()
      await savePublicNote(TOKEN, 't-1', { note: 'office supplies' })

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(`${TEST_BASE_URL}/v1/public/uncats/${TOKEN}/t-1`)
      expect(init.method).toBe('PATCH')
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(init.body)).toEqual({ note: 'office supplies' })
    })

    it('throws on 410', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(410, { code: 'PUBLIC_LINK_REVOKED' }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const { savePublicNote } = await importApi()
      await expect(
        savePublicNote(TOKEN, 't-1', { note: 'x' }),
      ).rejects.toBeDefined()
    })
  })
})
