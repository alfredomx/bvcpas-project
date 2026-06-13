import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ManagePortalsSheet } from './manage-portals-sheet'

vi.mock('../hooks/use-bank-portals', () => ({
  BANK_PORTALS_QUERY_KEY: 'bank-portals',
  useBankPortals: () => ({
    data: {
      data: [
        {
          id: 'p-1',
          name: 'Chase',
          portal_url: 'https://chase.com',
          created_at: '',
          updated_at: '',
        },
        { id: 'p-2', name: 'Frost Bank', portal_url: null, created_at: '', updated_at: '' },
      ],
    },
    isLoading: false,
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('<ManagePortalsSheet>', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists portals from the catalog', () => {
    render(<ManagePortalsSheet open onOpenChange={() => {}} />, { wrapper })
    expect(screen.getByText('Chase')).toBeInTheDocument()
    expect(screen.getByText('Frost Bank')).toBeInTheDocument()
  })

  it('filters the list by name', async () => {
    render(<ManagePortalsSheet open onOpenChange={() => {}} />, { wrapper })
    await userEvent.setup().type(screen.getByLabelText('Search portal'), 'frost')
    expect(screen.queryByText('Chase')).not.toBeInTheDocument()
    expect(screen.getByText('Frost Bank')).toBeInTheDocument()
  })
})
