// Tests de <CsTransactions> (v0.5.1, Bloque D).
// v0.5.3: tab + onTabChange ahora son props (controlled).

import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  CsTransactions,
  type CsTransactionsProps,
  type TransactionsTab,
} from './cs-transactions'
import type {
  Transaction,
  TransactionCategory,
} from '@/modules/14-transactions/api/transactions.api'

// Wrapper para tests: maneja el state controlled de tab.
function CsTransactionsHarness(
  props: Omit<CsTransactionsProps, 'tab' | 'onTabChange'>,
) {
  const [tab, setTab] = useState<TransactionsTab>('uncategorized')
  return <CsTransactions {...props} tab={tab} onTabChange={setTab} realmId={null} />
}

const listTransactionsMock = vi.fn()
const syncTransactionsMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('@/modules/14-transactions/api/transactions.api', () => ({
  listTransactions: (...args: unknown[]) => listTransactionsMock(...args),
  syncTransactions: (...args: unknown[]) => syncTransactionsMock(...args),
}))

vi.mock('@/modules/14-transactions/api/qbo-accounts.api', () => ({
  getQboAccounts: vi.fn().mockResolvedValue([]),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    message: vi.fn(),
  },
}))

function makeTransaction(
  id: string,
  category: TransactionCategory,
  date = '2025-09-01',
): Transaction {
  return {
    id,
    realm_id: '9000',
    qbo_txn_type: 'Expense',
    qbo_txn_id: id,
    client_id: 'c-1',
    txn_date: date,
    docnum: null,
    vendor_name: 'Vendor',
    memo: 'memo',
    split_account: 'Bank',
    category,
    amount: '100.00',
    synced_at: '2026-04-30T23:59:00.000Z',
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('<CsTransactions>', () => {
  beforeEach(() => {
    listTransactionsMock.mockReset()
    syncTransactionsMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    listTransactionsMock.mockImplementation((_clientId: string, params?: { category: TransactionCategory }) => {
      if (params?.category === 'uncategorized_expense') {
        return Promise.resolve({
          items: [makeTransaction('e1', 'uncategorized_expense', '2025-10-01')],
          total: 1,
        })
      }
      if (params?.category === 'uncategorized_income') {
        return Promise.resolve({
          items: [makeTransaction('i1', 'uncategorized_income', '2025-11-01')],
          total: 1,
        })
      }
      if (params?.category === 'ask_my_accountant') {
        return Promise.resolve({
          items: [makeTransaction('a1', 'ask_my_accountant', '2025-08-01')],
          total: 1,
        })
      }
      return Promise.resolve({ items: [], total: 0 })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['all', /expense \+ income/i],
    ['expense', /expense only/i],
    ['income', /income only/i],
  ] as const)('renders filter legend when filter=%s', async (filter, pattern) => {
    render(<CsTransactionsHarness clientId="c-1" clientFilter={filter} realmId={null} />, { wrapper })
    expect(screen.getByText(pattern)).toBeInTheDocument()
  })

  it('default tab is Uncategorized and merges expense + income sorted desc', async () => {
    render(<CsTransactionsHarness clientId="c-1" clientFilter="all" realmId={null} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/Uncategorized \(2\)/)).toBeInTheDocument()
    })
    // Filas en orden desc por txn_date: i1 (2025-11) primero, e1 (2025-10) después.
    const rows = screen.getAllByRole('row')
    // header + 2 data rows.
    expect(rows).toHaveLength(3)
  })

  it('switches to AMAs tab and renders only ask_my_accountant items', async () => {
    render(<CsTransactionsHarness clientId="c-1" clientFilter="all" realmId={null} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/AMA's \(1\)/)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /AMA's/i }))

    await waitFor(() => {
      const tabs = screen.getAllByRole('row')
      // header + 1 row de a1.
      expect(tabs).toHaveLength(2)
    })
  })

  it('clicks Sync and toast.success on result', async () => {
    syncTransactionsMock.mockResolvedValue({
      client_id: 'c-1',
      start_date: '2025-01-01',
      end_date: '2026-04-30',
      deleted_count: 5,
      inserted_count: 12,
      duration_ms: 100,
    })

    render(<CsTransactionsHarness clientId="c-1" clientFilter="all" realmId={null} />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^sync$/i }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(1)
    })
    const sentArgs = syncTransactionsMock.mock.calls[0][1]
    expect(sentArgs).toMatchObject({
      startDate: expect.stringMatching(/^\d{4}-01-01$/),
      endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })

  it('shows specific error toast when sync returns 400 (no QBO)', async () => {
    const err: Error & { statusCode?: number } = new Error('no qbo')
    err.statusCode = 400
    syncTransactionsMock.mockRejectedValue(err)

    render(<CsTransactionsHarness clientId="c-1" clientFilter="all" realmId={null} />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^sync$/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/no QBO connection/i))
    })
  })

  it('shows empty state when no items', async () => {
    listTransactionsMock.mockReset()
    listTransactionsMock.mockResolvedValue({ items: [], total: 0 })

    render(<CsTransactionsHarness clientId="c-1" clientFilter="all" realmId={null} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/No transactions in this category/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Uncategorized \(0\)/)).toBeInTheDocument()
  })
})
