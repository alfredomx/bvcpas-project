// Tests del wrapper de transactions (v0.5.1, Bloque A).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleListResponse = {
  items: [
    {
      id: 't-1',
      realm_id: '9000',
      qbo_txn_type: 'Expense',
      qbo_txn_id: '13192',
      client_id: 'c-1',
      txn_date: '2025-09-01',
      docnum: null,
      vendor_name: 'CCS Concessions',
      memo: '10/05 NBS-CSC*CCS',
      split_account: 'Bank of America #5096',
      category: 'uncategorized_expense',
      amount: '200.00',
      synced_at: '2026-04-30T23:59:00.000Z',
      qbo_account_id: null,
      response: null,
    },
  ],
  total: 1,
}

const sampleSyncResponse = {
  client_id: 'c-1',
  start_date: '2025-01-01',
  end_date: '2026-04-30',
  deleted_count: 5,
  inserted_count: 12,
  duration_ms: 1234,
}

async function importApi(): Promise<typeof import('./transactions.api')> {
  return await import('./transactions.api')
}

describe('transactions.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listTransactions', () => {
    it('calls GET /v1/clients/:id/transactions without query when no params', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleListResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { listTransactions } = await importApi()
      const result = await listTransactions('c-1')

      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(`${TEST_BASE_URL}/v1/clients/c-1/transactions`)
      expect(calledRequest.method).toBe('GET')
      expect(result).toEqual(sampleListResponse)
    })

    it('forwards category as query param', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleListResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { listTransactions } = await importApi()
      await listTransactions('c-1', { category: 'uncategorized_expense' })

      const [calledRequest] = fetchMock.mock.calls[0]
      const url = new URL(calledRequest.url)
      expect(url.pathname).toBe('/v1/clients/c-1/transactions')
      expect(url.searchParams.get('category')).toBe('uncategorized_expense')
    })

    it('throws on non-2xx', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, {}))
      vi.stubGlobal('fetch', fetchMock)

      const { listTransactions } = await importApi()
      await expect(listTransactions('c-1')).rejects.toBeDefined()
    })
  })

  describe('syncTransactions', () => {
    it('POSTs to /v1/clients/:id/transactions/sync with body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleSyncResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { syncTransactions } = await importApi()
      const result = await syncTransactions('c-1', {
        startDate: '2025-01-01',
        endDate: '2026-04-30',
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledRequest] = fetchMock.mock.calls[0]
      expect(calledRequest.url).toBe(`${TEST_BASE_URL}/v1/clients/c-1/transactions/sync`)
      expect(calledRequest.method).toBe('POST')
      const sentBody = await calledRequest.text()
      expect(JSON.parse(sentBody)).toEqual({
        startDate: '2025-01-01',
        endDate: '2026-04-30',
      })
      expect(result.inserted_count).toBe(12)
    })

    it('throws on 400 (no QBO connection)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { statusCode: 400, code: 'NO_QBO_CONNECTION' }))
      vi.stubGlobal('fetch', fetchMock)

      const { syncTransactions } = await importApi()
      await expect(
        syncTransactions('c-1', { startDate: '2025-01-01', endDate: '2026-04-30' }),
      ).rejects.toBeDefined()
    })
  })

  describe('saveTransactionNote', () => {
    const sampleResponse = {
      id: 'r-1',
      client_id: 'c-1',
      realm_id: '9000',
      qbo_txn_type: 'Expense',
      qbo_txn_id: '13192',
      txn_date: '2025-09-01',
      vendor_name: 'CCS',
      memo: 'memo',
      split_account: 'Bank',
      category: 'uncategorized_expense',
      amount: '200.00',
      client_note: 'office supplies',
      qbo_account_id: '84',
      completed: true,
      responded_at: '2026-05-10T00:00:00.000Z',
      synced_to_qbo_at: null,
    }

    it('PATCHes with qbo_sync=false by default', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { saveTransactionNote } = await importApi()
      await saveTransactionNote('c-1', 't-1', {
        note: 'office supplies',
        qbo_account_id: '84',
        completed: true,
      })

      const [calledRequest] = fetchMock.mock.calls[0]
      const url = new URL(calledRequest.url)
      expect(url.pathname).toBe('/v1/clients/c-1/transactions/responses/t-1')
      expect(url.searchParams.get('qbo_sync')).toBe('false')
      expect(calledRequest.method).toBe('PATCH')
    })

    it('PATCHes with qbo_sync=true when qboSync option is true', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse))
      vi.stubGlobal('fetch', fetchMock)

      const { saveTransactionNote } = await importApi()
      await saveTransactionNote(
        'c-1',
        't-1',
        { note: 'office supplies', qbo_account_id: '84', completed: true },
        { qboSync: true },
      )

      const [calledRequest] = fetchMock.mock.calls[0]
      const url = new URL(calledRequest.url)
      expect(url.searchParams.get('qbo_sync')).toBe('true')
    })

    it('throws on non-2xx', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, {}))
      vi.stubGlobal('fetch', fetchMock)

      const { saveTransactionNote } = await importApi()
      await expect(
        saveTransactionNote('c-1', 't-1', {
          note: 'x',
          qbo_account_id: null,
          completed: false,
        }),
      ).rejects.toBeDefined()
    })
  })
})
