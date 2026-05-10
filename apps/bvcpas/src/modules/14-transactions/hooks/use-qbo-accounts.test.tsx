// Tests del hook useQboAccounts (v0.5.5, Bloque B).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useQboAccounts } from './use-qbo-accounts'

const getQboAccountsMock = vi.fn()

vi.mock('../api/qbo-accounts.api', () => ({
  getQboAccounts: (...args: unknown[]) => getQboAccountsMock(...args),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function Probe({ realmId }: { realmId: string | null }) {
  const { accounts, isLoading, isError } = useQboAccounts(realmId)
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <span data-testid="error">{isError ? 'true' : 'false'}</span>
      <span data-testid="count">{accounts.length}</span>
    </div>
  )
}

describe('useQboAccounts', () => {
  beforeEach(() => {
    getQboAccountsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches accounts when realmId is provided', async () => {
    getQboAccountsMock.mockResolvedValue([
      { Id: '1', Name: 'Expense', AccountType: 'Expense' },
      { Id: '2', Name: 'Bank', AccountType: 'Bank' },
    ])

    render(<Probe realmId="9000" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('count').textContent).toBe('2')
    })
    expect(getQboAccountsMock).toHaveBeenCalledWith('9000')
  })

  it('does not fetch when realmId is null', () => {
    render(<Probe realmId={null} />, { wrapper })
    expect(getQboAccountsMock).not.toHaveBeenCalled()
  })

  it('exposes isError=true on rejection', async () => {
    getQboAccountsMock.mockRejectedValue(new Error('boom'))

    render(<Probe realmId="9000" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('true')
    })
  })
})
