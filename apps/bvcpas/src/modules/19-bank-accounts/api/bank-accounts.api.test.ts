// Tests del wrapper de bank-accounts (v0.1.0).
// Estrategia idéntica a clients.api.test.ts: stubEnv + stubGlobal fetch.

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

const sampleLoginsList = {
  items: [
    {
      id: 'cred-1',
      client: { id: 'c-1', legal_name: 'Acme LLC' },
      portal: { id: 'p-1', name: 'Chase', portal_url: 'https://chase.com' },
      status: 'active',
      notes: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
    },
  ],
  total: 1,
  limit: 200,
  offset: 0,
}

const sampleLogin = {
  id: 'cred-1',
  client: { id: 'c-1', legal_name: 'Acme LLC' },
  portal: { id: 'p-1', name: 'Chase', portal_url: null },
  status: 'active',
  notes: null,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
}

const sampleAccountsList = {
  data: [
    {
      id: 'acc-1',
      client_bank_account_id: 'cred-1',
      account_mask: '4242',
      account_type: 'checking',
      label: null,
      status: 'active',
      notes: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
    },
  ],
}

const sampleAccount = sampleAccountsList.data[0]

const samplePortalsList = {
  data: [
    {
      id: 'p-1',
      name: 'Chase',
      portal_url: 'https://chase.com',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
}

async function importApi(): Promise<typeof import('./bank-accounts.api')> {
  return await import('./bank-accounts.api')
}

describe('bank-accounts.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listBankLogins', () => {
    it('GETs /v1/banking/credentials with no query when no args', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, sampleLoginsList))
      vi.stubGlobal('fetch', fetchMock)

      const { listBankLogins } = await importApi()
      const result = await listBankLogins()

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/credentials`)
      expect(req.method).toBe('GET')
      expect(result.total).toBe(1)
      expect(result.items[0].client.legal_name).toBe('Acme LLC')
    })

    it('forwards filters as query params', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, sampleLoginsList))
      vi.stubGlobal('fetch', fetchMock)

      const { listBankLogins } = await importApi()
      await listBankLogins({
        clientId: 'c-1',
        portalId: 'p-1',
        status: 'active',
        search: 'chase',
        limit: 50,
        offset: 10,
      })

      const [req] = fetchMock.mock.calls[0]
      const url = new URL(req.url)
      expect(url.pathname).toBe('/v1/banking/credentials')
      expect(url.searchParams.get('clientId')).toBe('c-1')
      expect(url.searchParams.get('portalId')).toBe('p-1')
      expect(url.searchParams.get('status')).toBe('active')
      expect(url.searchParams.get('search')).toBe('chase')
      expect(url.searchParams.get('limit')).toBe('50')
      expect(url.searchParams.get('offset')).toBe('10')
    })

    it('throws on non-2xx', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(500, { code: 'INTERNAL' })),
      )
      const { listBankLogins } = await importApi()
      await expect(listBankLogins()).rejects.toBeDefined()
    })
  })

  describe('getBankLogin', () => {
    it('GETs /v1/banking/credentials/:credentialId', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleLogin))
      vi.stubGlobal('fetch', fetchMock)

      const { getBankLogin } = await importApi()
      const result = await getBankLogin('cred-1')

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/credentials/cred-1`)
      expect(req.method).toBe('GET')
      expect(result.id).toBe('cred-1')
    })
  })

  describe('createBankLogin', () => {
    it('POSTs /v1/banking/credentials with body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, sampleLogin))
      vi.stubGlobal('fetch', fetchMock)

      const { createBankLogin } = await importApi()
      const result = await createBankLogin({
        clientId: 'c-1',
        bankPortalId: 'p-1',
        username: 'jdoe',
        password: 'secret',
      })

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/credentials`)
      expect(req.method).toBe('POST')
      const body = await req.text()
      expect(JSON.parse(body)).toEqual({
        clientId: 'c-1',
        bankPortalId: 'p-1',
        username: 'jdoe',
        password: 'secret',
      })
      expect(result.id).toBe('cred-1')
    })

    it('throws on 409 (duplicate)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(409, { code: 'DUPLICATE' })),
      )
      const { createBankLogin } = await importApi()
      await expect(
        createBankLogin({
          clientId: 'c-1',
          bankPortalId: 'p-1',
          username: 'x',
          password: 'y',
        }),
      ).rejects.toBeDefined()
    })
  })

  describe('updateBankLogin', () => {
    it('PATCHes /v1/banking/credentials/:credentialId with body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleLogin))
      vi.stubGlobal('fetch', fetchMock)

      const { updateBankLogin } = await importApi()
      await updateBankLogin('cred-1', { password: 'newpass', notes: 'rotated' })

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/credentials/cred-1`)
      expect(req.method).toBe('PATCH')
      const body = await req.text()
      expect(JSON.parse(body)).toEqual({
        password: 'newpass',
        notes: 'rotated',
      })
    })
  })

  describe('deleteBankLogin', () => {
    it('DELETEs /v1/banking/credentials/:credentialId', async () => {
      const fetchMock = vi.fn().mockResolvedValue(noContentResponse())
      vi.stubGlobal('fetch', fetchMock)

      const { deleteBankLogin } = await importApi()
      await deleteBankLogin('cred-1')

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/credentials/cred-1`)
      expect(req.method).toBe('DELETE')
    })
  })

  describe('listBankAccounts', () => {
    it('GETs /v1/banking/credentials/:credentialId/accounts', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, sampleAccountsList))
      vi.stubGlobal('fetch', fetchMock)

      const { listBankAccounts } = await importApi()
      const result = await listBankAccounts('cred-1')

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(
        `${TEST_BASE_URL}/v1/banking/credentials/cred-1/accounts`,
      )
      expect(req.method).toBe('GET')
      expect(result.data[0].account_mask).toBe('4242')
    })
  })

  describe('createBankAccount', () => {
    it('POSTs /v1/banking/credentials/:credentialId/accounts', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, sampleAccount))
      vi.stubGlobal('fetch', fetchMock)

      const { createBankAccount } = await importApi()
      await createBankAccount('cred-1', {
        accountMask: '4242',
        accountType: 'checking',
      })

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(
        `${TEST_BASE_URL}/v1/banking/credentials/cred-1/accounts`,
      )
      expect(req.method).toBe('POST')
      const body = await req.text()
      expect(JSON.parse(body)).toEqual({
        accountMask: '4242',
        accountType: 'checking',
      })
    })
  })

  describe('updateBankAccount', () => {
    it('PATCHes /v1/banking/accounts/:accountId', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleAccount))
      vi.stubGlobal('fetch', fetchMock)

      const { updateBankAccount } = await importApi()
      await updateBankAccount('acc-1', { label: 'Primary' })

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/accounts/acc-1`)
      expect(req.method).toBe('PATCH')
    })
  })

  describe('changeBankAccountStatus', () => {
    it('POSTs /v1/banking/accounts/:accountId/status with body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleAccount))
      vi.stubGlobal('fetch', fetchMock)

      const { changeBankAccountStatus } = await importApi()
      await changeBankAccountStatus('acc-1', {
        status: 'closed',
        reason: 'account closed by client',
      })

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/accounts/acc-1/status`)
      expect(req.method).toBe('POST')
      const body = await req.text()
      expect(JSON.parse(body)).toEqual({
        status: 'closed',
        reason: 'account closed by client',
      })
    })
  })

  describe('deleteBankAccount', () => {
    it('DELETEs /v1/banking/accounts/:accountId', async () => {
      const fetchMock = vi.fn().mockResolvedValue(noContentResponse())
      vi.stubGlobal('fetch', fetchMock)

      const { deleteBankAccount } = await importApi()
      await deleteBankAccount('acc-1')

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/accounts/acc-1`)
      expect(req.method).toBe('DELETE')
    })
  })

  describe('listBankPortals', () => {
    it('GETs /v1/banking/portals', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, samplePortalsList))
      vi.stubGlobal('fetch', fetchMock)

      const { listBankPortals } = await importApi()
      const result = await listBankPortals()

      const [req] = fetchMock.mock.calls[0]
      expect(req.url).toBe(`${TEST_BASE_URL}/v1/banking/portals`)
      expect(req.method).toBe('GET')
      expect(result.data[0].name).toBe('Chase')
    })
  })
})
