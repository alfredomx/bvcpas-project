// Tests del wrapper de cuentas QBO (v0.5.5, Bloque B).
// Usa el proxy POST /v1/intuit/realms/{realmId}/call con una
// query de Account.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_BASE_URL = 'https://test.example.com'
const REALM_ID = '9130357380579716'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleQboResponse = {
  QueryResponse: {
    Account: [
      {
        Id: '116',
        Name: 'Accounts Payable (A/P)',
        AcctNum: '2000',
        AccountType: 'Accounts Payable',
        SubAccount: false,
        FullyQualifiedName: 'Accounts Payable (A/P)',
        Active: true,
      },
      {
        Id: '84',
        Name: 'Administrative Charges',
        AccountType: 'Expense',
        SubAccount: false,
        FullyQualifiedName: 'Administrative Charges',
        Active: true,
      },
      {
        Id: '98',
        Name: 'Ask My Accountant',
        AccountType: 'Expense',
        SubAccount: true,
        ParentRef: { value: '84' },
        FullyQualifiedName: 'Administrative Charges:Ask My Accountant',
        Active: true,
      },
    ],
    startPosition: 1,
    maxResults: 3,
  },
}

async function importApi(): Promise<typeof import('./qbo-accounts.api')> {
  return await import('./qbo-accounts.api')
}

describe('qbo-accounts.api', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', TEST_BASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('POSTs to the intuit proxy with an Account query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleQboResponse))
    vi.stubGlobal('fetch', fetchMock)

    const { getQboAccounts } = await importApi()
    const result = await getQboAccounts(REALM_ID)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledRequest] = fetchMock.mock.calls[0]
    expect(calledRequest.url).toBe(
      `${TEST_BASE_URL}/v1/intuit/realms/${REALM_ID}/call`,
    )
    expect(calledRequest.method).toBe('POST')
    const body = JSON.parse(await calledRequest.text())
    expect(body.method).toBe('GET')
    expect(body.path).toContain('Account')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      Id: '116',
      Name: 'Accounts Payable (A/P)',
      AcctNum: '2000',
      AccountType: 'Accounts Payable',
      SubAccount: false,
      ParentId: null,
      FullyQualifiedName: 'Accounts Payable (A/P)',
    })
    expect(result[2]).toEqual({
      Id: '98',
      Name: 'Ask My Accountant',
      AcctNum: null,
      AccountType: 'Expense',
      SubAccount: true,
      ParentId: '84',
      FullyQualifiedName: 'Administrative Charges:Ask My Accountant',
    })
  })

  it('returns empty array when QueryResponse has no Account key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { QueryResponse: {} }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { getQboAccounts } = await importApi()
    const result = await getQboAccounts(REALM_ID)
    expect(result).toEqual([])
  })

  it('throws on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {}))
    vi.stubGlobal('fetch', fetchMock)

    const { getQboAccounts } = await importApi()
    await expect(getQboAccounts(REALM_ID)).rejects.toBeDefined()
  })
})
