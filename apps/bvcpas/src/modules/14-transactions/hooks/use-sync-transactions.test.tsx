// Tests del hook useSyncTransactions (v0.5.1, Bloque C).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useSyncTransactions } from './use-sync-transactions'

const syncTransactionsMock = vi.fn()

vi.mock('../api/transactions.api', () => ({
  syncTransactions: (...args: unknown[]) => syncTransactionsMock(...args),
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function Probe({ clientId }: { clientId: string }) {
  const sync = useSyncTransactions(clientId)
  return (
    <div>
      <span data-testid="pending">{sync.isPending ? 'true' : 'false'}</span>
      <span data-testid="success-count">{sync.data?.inserted_count ?? ''}</span>
      <button
        type="button"
        onClick={() => sync.mutate({ startDate: '2025-01-01', endDate: '2026-04-30' })}
      >
        Sync
      </button>
    </div>
  )
}

describe('useSyncTransactions', () => {
  beforeEach(() => {
    syncTransactionsMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs the mutation and returns the SyncResult', async () => {
    syncTransactionsMock.mockResolvedValue({
      client_id: 'c-1',
      start_date: '2025-01-01',
      end_date: '2026-04-30',
      deleted_count: 5,
      inserted_count: 12,
      duration_ms: 100,
    })

    render(<Probe clientId="c-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sync/i }))

    await waitFor(() => {
      expect(screen.getByTestId('success-count').textContent).toBe('12')
    })
    expect(syncTransactionsMock).toHaveBeenCalledWith('c-1', {
      startDate: '2025-01-01',
      endDate: '2026-04-30',
    })
  })

  it('invalidates transactions and uncats-detail queries on success', async () => {
    syncTransactionsMock.mockResolvedValue({
      client_id: 'c-1',
      start_date: '2025-01-01',
      end_date: '2026-04-30',
      deleted_count: 0,
      inserted_count: 1,
      duration_ms: 50,
    })

    // Sembramos cache para validar invalidación.
    queryClient.setQueryData(['transactions', 'c-1', 'uncategorized_expense'], { items: [] })
    queryClient.setQueryData(['uncats-detail', 'c-1', 'a', 'b'], { stub: true })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe clientId="c-1" />, { wrapper })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sync/i }))

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions', 'c-1'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['uncats-detail', 'c-1'] })
    })
  })
})
