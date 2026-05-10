// Tests del hook useTransactions (v0.5.1, Bloque B).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useTransactions } from './use-transactions'
import type { Transaction, TransactionCategory } from '../api/transactions.api'

const listTransactionsMock = vi.fn()

vi.mock('../api/transactions.api', () => ({
  listTransactions: (...args: unknown[]) => listTransactionsMock(...args),
}))

function makeTransaction(id: string, category: TransactionCategory): Transaction {
  return {
    id,
    realm_id: '9000',
    qbo_txn_type: 'Expense',
    qbo_txn_id: id,
    client_id: 'c-1',
    txn_date: '2025-09-01',
    docnum: null,
    vendor_name: 'Vendor',
    memo: null,
    split_account: 'Bank',
    category,
    amount: '100.00',
    synced_at: '2026-04-30T23:59:00.000Z',
    qbo_account_id: null,
    response: null,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function Probe({
  clientId,
  category,
}: {
  clientId: string
  category: TransactionCategory
}) {
  const { items, isLoading, isError } = useTransactions(clientId, category)
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <span data-testid="error">{isError ? 'true' : 'false'}</span>
      <span data-testid="count">{items.length}</span>
    </div>
  )
}

describe('useTransactions', () => {
  beforeEach(() => {
    listTransactionsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls api with category and exposes items', async () => {
    listTransactionsMock.mockResolvedValue({
      items: [makeTransaction('t-1', 'uncategorized_expense')],
      total: 1,
    })

    render(<Probe clientId="c-1" category="uncategorized_expense" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('count').textContent).toBe('1')
    })
    const [calledClientId, params] = listTransactionsMock.mock.calls[0]
    expect(calledClientId).toBe('c-1')
    expect(params).toEqual({ category: 'uncategorized_expense' })
  })

  it('isError=true when api rejects', async () => {
    listTransactionsMock.mockRejectedValue(new Error('boom'))

    render(<Probe clientId="c-1" category="ask_my_accountant" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('true')
    })
  })
})
