import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useBankLogins } from './use-bank-logins'

const listBankLoginsMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  listBankLogins: (...args: unknown[]) => listBankLoginsMock(...args),
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function Probe({ filters }: { filters?: { search?: string } }) {
  const q = useBankLogins(filters ?? {})
  return (
    <div>
      <span data-testid="loading">{q.isLoading ? 'true' : 'false'}</span>
      <span data-testid="total">{q.data?.total ?? 0}</span>
    </div>
  )
}

describe('useBankLogins', () => {
  beforeEach(() => {
    listBankLoginsMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('calls listBankLogins and exposes total', async () => {
    listBankLoginsMock.mockResolvedValue({ items: [], total: 7, limit: 200, offset: 0 })

    render(<Probe />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('7')
    })
    expect(listBankLoginsMock).toHaveBeenCalledWith({})
  })

  it('forwards filters to api', async () => {
    listBankLoginsMock.mockResolvedValue({ items: [], total: 0, limit: 200, offset: 0 })

    render(<Probe filters={{ search: 'chase' }} />, { wrapper })

    await waitFor(() => {
      expect(listBankLoginsMock).toHaveBeenCalledWith({ search: 'chase' })
    })
  })
})
