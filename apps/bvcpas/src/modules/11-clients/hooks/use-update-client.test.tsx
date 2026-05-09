// Tests del hook useUpdateClient (v0.5.2, Bloque C).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useUpdateClient } from './use-update-client'

const updateClientMock = vi.fn()

vi.mock('../api/clients.api', () => ({
  updateClient: (...args: unknown[]) => updateClientMock(...args),
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function Probe({ clientId }: { clientId: string }) {
  const update = useUpdateClient(clientId)
  return (
    <div>
      <span data-testid="pending">{update.isPending ? 'true' : 'false'}</span>
      <span data-testid="success-name">{update.data?.legal_name ?? ''}</span>
      <button
        type="button"
        onClick={() => update.mutate({ transactionsFilter: 'expense' })}
      >
        Save
      </button>
    </div>
  )
}

describe('useUpdateClient', () => {
  beforeEach(() => {
    updateClientMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs the mutation and returns the updated client', async () => {
    updateClientMock.mockResolvedValue({
      id: 'c-1',
      legal_name: 'Acme LLC',
      transactions_filter: 'expense',
    })

    render(<Probe clientId="c-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByTestId('success-name').textContent).toBe('Acme LLC')
    })
    expect(updateClientMock).toHaveBeenCalledWith('c-1', { transactionsFilter: 'expense' })
  })

  it('invalidates uncats-detail and clients queries on success', async () => {
    updateClientMock.mockResolvedValue({ id: 'c-1', legal_name: 'X' })

    queryClient.setQueryData(['uncats-detail', 'c-1', 'a', 'b'], { stub: true })
    queryClient.setQueryData(['clients', { pageSize: 200 }], { stub: true })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe clientId="c-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['uncats-detail', 'c-1'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients'] })
    })
  })
})
