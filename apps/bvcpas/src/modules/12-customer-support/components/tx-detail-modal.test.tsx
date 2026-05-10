// Tests de <TxDetailModal> (v0.5.5, Bloque D).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TxDetailModal } from './tx-detail-modal'
import type { Transaction } from '@/modules/14-transactions/api/transactions.api'

const getQboAccountsMock = vi.fn()
const saveTransactionNoteMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('@/modules/14-transactions/api/qbo-accounts.api', () => ({
  getQboAccounts: (...args: unknown[]) => getQboAccountsMock(...args),
}))

vi.mock('@/modules/14-transactions/api/transactions.api', () => ({
  saveTransactionNote: (...args: unknown[]) => saveTransactionNoteMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    message: vi.fn(),
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

const sampleTx: Transaction = {
  id: 'tx-1',
  realm_id: '9000',
  qbo_txn_type: 'Expense',
  qbo_txn_id: '11913',
  client_id: 'c-1',
  txn_date: '2026-02-05',
  docnum: null,
  vendor_name: 'Paypal',
  memo: 'PAYPAL *SANANTONIOR.O XXX-XXX-7733 CA 02/05',
  split_account: 'Chase Checking #9C27',
  category: 'uncategorized_expense',
  amount: '146.00',
  synced_at: '2026-04-30T23:59:00.000Z',
  qbo_account_id: null,
  response: null,
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('<TxDetailModal>', () => {
  beforeEach(() => {
    getQboAccountsMock.mockReset()
    saveTransactionNoteMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    window.localStorage.clear()
    getQboAccountsMock.mockResolvedValue([
      { Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' },
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders vendor name + amount + memo when open', () => {
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={() => {}}
      />,
      { wrapper },
    )

    expect(screen.getByText('Paypal')).toBeInTheDocument()
    expect(screen.getByText('-$146')).toBeInTheDocument()
    expect(
      screen.getByText('PAYPAL *SANANTONIOR.O XXX-XXX-7733 CA 02/05'),
    ).toBeInTheDocument()
  })

  it('renders account dropdown with QBO accounts', async () => {
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={() => {}}
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  it('shows QBO not connected when realmId is null', () => {
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId={null}
        accounts={[]}
        open={true}
        onClose={() => {}}
      />,
      { wrapper },
    )

    expect(screen.getByText(/QBO not connected/i)).toBeInTheDocument()
  })

  it('shows note preview when typing', async () => {
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={() => {}}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText(/what was this transaction for/i),
      'office supplies',
    )

    // Preview section appears once note is non-empty.
    await waitFor(() => {
      expect(screen.getByText(/Preview/i)).toBeInTheDocument()
    })
    // The preview text contains the note and the suffix.
    const preview = screen.getByText(/as per client/i)
    expect(preview.textContent).toMatch(/office supplies/)
  })

  it('Save calls API and shows success toast then closes modal', async () => {
    saveTransactionNoteMock.mockResolvedValue({})
    const onClose = vi.fn()
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={onClose}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    // Necesita nota para poder guardar.
    await user.type(screen.getByLabelText(/what was this transaction for/i), 'office supplies')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
    expect(saveTransactionNoteMock).toHaveBeenCalledWith(
      sampleTx.client_id,
      sampleTx.id,
      expect.objectContaining({ note: 'office supplies' }),
    )
  })

  it('Save shows error toast when API rejects', async () => {
    saveTransactionNoteMock.mockRejectedValue(new Error('boom'))
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={() => {}}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/what was this transaction for/i), 'office supplies')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1)
    })
  })

  it('Save blocks if note is empty', async () => {
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={() => {}}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(saveTransactionNoteMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
  })

  it('Cancel closes without saving', async () => {
    const onClose = vi.fn()
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={onClose}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(saveTransactionNoteMock).not.toHaveBeenCalled()
  })

  it('suffix input persists to localStorage', async () => {
    render(
      <TxDetailModal
        transaction={sampleTx}
        realmId="9000"
        accounts={[{ Id: '84', Name: 'Administrative Charges', AccountType: 'Expense' }]}
        open={true}
        onClose={() => {}}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    const suffixInput = screen.getByLabelText(/appended text/i)
    await user.clear(suffixInput)
    await user.type(suffixInput, ' - per client approval')

    expect(window.localStorage.getItem('bvcpas.noteSuffix')).toBe(
      ' - per client approval',
    )
  })
})
