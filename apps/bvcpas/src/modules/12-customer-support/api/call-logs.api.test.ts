// Tests del wrapper de call-logs (v0.7.0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleCallLog = {
  id: 'log-1',
  client_id: 'c-1',
  user_id: 'u-1',
  called_at: '2026-05-14T10:00:00.000Z',
  outcome: 'responded',
  notes: 'Quick chat',
  created_at: '2026-05-14T10:00:00.000Z',
  updated_at: '2026-05-14T10:00:00.000Z',
}

const sampleListResponse = {
  items: [sampleCallLog],
  limit: 20,
  offset: 0,
}

async function importApi(): Promise<typeof import('./call-logs.api')> {
  return await import('./call-logs.api')
}

describe('call-logs.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listCallLogs', () => {
    it('GETs /v1/clients/:id/call-logs', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleListResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { listCallLogs } = await importApi()
      const result = await listCallLogs('c-1')

      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(`${TEST_BASE_URL}/v1/clients/c-1/call-logs`)
      expect(calledRequest.method).toBe('GET')
      expect(result).toEqual(sampleListResponse)
    })

    it('throws on non-2xx', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, {}))
      vi.stubGlobal('fetch', fetchMock)

      const { listCallLogs } = await importApi()
      await expect(listCallLogs('c-1')).rejects.toBeDefined()
    })
  })

  describe('createCallLog', () => {
    it('POSTs body to /v1/clients/:id/call-logs', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, sampleCallLog))
      vi.stubGlobal('fetch', fetchMock)

      const { createCallLog } = await importApi()
      const result = await createCallLog('c-1', {
        outcome: 'responded',
        notes: 'Quick chat',
      })

      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(`${TEST_BASE_URL}/v1/clients/c-1/call-logs`)
      expect(calledRequest.method).toBe('POST')
      const sentBody = JSON.parse(await calledRequest.text())
      expect(sentBody).toEqual({ outcome: 'responded', notes: 'Quick chat' })
      expect(result.id).toBe('log-1')
    })

    it('throws on 400', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, {}))
      vi.stubGlobal('fetch', fetchMock)

      const { createCallLog } = await importApi()
      await expect(
        createCallLog('c-1', { outcome: 'responded' }),
      ).rejects.toBeDefined()
    })
  })

  describe('updateCallLog', () => {
    it('PATCHes /v1/clients/:id/call-logs/:logId', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleCallLog))
      vi.stubGlobal('fetch', fetchMock)

      const { updateCallLog } = await importApi()
      await updateCallLog('c-1', 'log-1', { notes: 'updated' })

      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/clients/c-1/call-logs/log-1`,
      )
      expect(calledRequest.method).toBe('PATCH')
    })
  })

  describe('deleteCallLog', () => {
    it('DELETEs /v1/clients/:id/call-logs/:logId', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchMock)

      const { deleteCallLog } = await importApi()
      await deleteCallLog('c-1', 'log-1')

      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(
        `${TEST_BASE_URL}/v1/clients/c-1/call-logs/log-1`,
      )
      expect(calledRequest.method).toBe('DELETE')
    })

    it('throws on 404', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, {}))
      vi.stubGlobal('fetch', fetchMock)

      const { deleteCallLog } = await importApi()
      await expect(deleteCallLog('c-1', 'log-x')).rejects.toBeDefined()
    })
  })
})
