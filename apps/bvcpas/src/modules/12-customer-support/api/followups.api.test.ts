// Tests del wrapper de followups (v0.6.0, Bloque A).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleFollowup = {
  client_id: 'c-1',
  period: '2026-04',
  status: 'sent',
  sent_at: '2026-05-12T00:00:00.000Z',
  last_reply_at: null,
  sent_by_user_id: 'u-1',
  internal_notes: null,
}

async function importApi(): Promise<typeof import('./followups.api')> {
  return await import('./followups.api')
}

describe('followups.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('updateFollowup', () => {
    it('PATCHes /v1/clients/:id/followups/:period with body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleFollowup))
      vi.stubGlobal('fetch', fetchMock)

      const { updateFollowup } = await importApi()
      const result = await updateFollowup('c-1', '2026-04', {
        status: 'sent',
        sentAt: '2026-05-12T00:00:00.000Z',
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/clients/c-1/followups/2026-04`,
      )
      expect(calledRequest.method).toBe('PATCH')
      const sentBody = await calledRequest.text()
      expect(JSON.parse(sentBody)).toEqual({
        status: 'sent',
        sentAt: '2026-05-12T00:00:00.000Z',
      })
      expect(result.status).toBe('sent')
    })

    it('throws on non-2xx', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { statusCode: 400, code: 'BAD_REQUEST' }))
      vi.stubGlobal('fetch', fetchMock)

      const { updateFollowup } = await importApi()
      await expect(
        updateFollowup('c-1', '2026-04', { status: 'sent' }),
      ).rejects.toBeDefined()
    })
  })
})
