// Tests del wrapper de public-links (v0.5.9, Bloque A).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const samplePublicLink = {
  id: 'pl-1',
  client_id: 'c-1',
  token: 'tok_abc123',
  purpose: 'uncats',
  expires_at: null,
  revoked_at: null,
  max_uses: null,
  use_count: 0,
  last_used_at: null,
  metadata: null,
  created_at: '2026-05-10T00:00:00.000Z',
  created_by_user_id: 'u-1',
}

async function importApi(): Promise<typeof import('./public-links.api')> {
  return await import('./public-links.api')
}

describe('public-links.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('createPublicLink', () => {
    it('POSTs body { purpose: "uncats" } by default (no force)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, samplePublicLink))
      vi.stubGlobal('fetch', fetchMock)

      const { createPublicLink } = await importApi()
      const result = await createPublicLink('c-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(`${TEST_BASE_URL}/v1/clients/c-1/public-links`)
      expect(calledRequest.method).toBe('POST')
      const sentBody = await calledRequest.text()
      expect(JSON.parse(sentBody)).toEqual({ purpose: 'uncats' })
      expect(result.token).toBe('tok_abc123')
    })

    it('POSTs body with force=true when option is set', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, samplePublicLink))
      vi.stubGlobal('fetch', fetchMock)

      const { createPublicLink } = await importApi()
      await createPublicLink('c-1', { force: true })

      const [calledRequest] = fetchMock.mock.calls[0]
      const sentBody = await calledRequest.text()
      expect(JSON.parse(sentBody)).toEqual({ purpose: 'uncats', force: true })
    })

    it('throws on non-2xx', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { statusCode: 400, code: 'BAD_REQUEST' }))
      vi.stubGlobal('fetch', fetchMock)

      const { createPublicLink } = await importApi()
      await expect(createPublicLink('c-1')).rejects.toBeDefined()
    })
  })

  describe('revokePublicLink', () => {
    it('POSTs /v1/clients/:id/public-links/:linkId/revoke', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchMock)

      const { revokePublicLink } = await importApi()
      await revokePublicLink('c-1', 'pl-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/clients/c-1/public-links/pl-1/revoke`,
      )
      expect(calledRequest.method).toBe('POST')
    })

    it('throws on 404', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(404, { statusCode: 404, code: 'NOT_FOUND' }))
      vi.stubGlobal('fetch', fetchMock)

      const { revokePublicLink } = await importApi()
      await expect(revokePublicLink('c-1', 'pl-x')).rejects.toBeDefined()
    })
  })
})
