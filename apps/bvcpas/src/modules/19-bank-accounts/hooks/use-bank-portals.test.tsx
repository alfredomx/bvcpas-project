import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useBankPortals } from './use-bank-portals'

const listBankPortalsMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  listBankPortals: () => listBankPortalsMock(),
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function Probe() {
  const q = useBankPortals()
  return <span data-testid="count">{q.data?.data.length ?? 0}</span>
}

describe('useBankPortals', () => {
  beforeEach(() => {
    listBankPortalsMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('exposes the portal list', async () => {
    listBankPortalsMock.mockResolvedValue({ data: [{ id: 'p-1' }, { id: 'p-2' }] })

    render(<Probe />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
    })
  })
})
