import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { BankAccountsScreen } from './bank-accounts-screen'

const listBankLoginsMock = vi.fn()
const listBankPortalsMock = vi.fn()
const listClientsMock = vi.fn()
const listBankAccountsMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  listBankLogins: (...args: unknown[]) => listBankLoginsMock(...args),
  listBankPortals: () => listBankPortalsMock(),
  listBankAccounts: (...args: unknown[]) => listBankAccountsMock(...args),
}))

vi.mock('@/modules/11-clients/api/clients.api', () => ({
  listClients: (...args: unknown[]) => listClientsMock(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const sampleLogins = {
  items: [
    {
      id: 'cred-1',
      client: { id: 'c-1', legal_name: 'Acme LLC' },
      portal: { id: 'p-1', name: 'Chase', portal_url: 'https://chase.com' },
      status: 'active',
      notes: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
    },
  ],
  total: 1,
  limit: 200,
  offset: 0,
}

describe('<BankAccountsScreen>', () => {
  beforeEach(() => {
    listBankLoginsMock.mockReset()
    listBankPortalsMock.mockReset()
    listClientsMock.mockReset()
    listBankAccountsMock.mockReset()
    listBankPortalsMock.mockResolvedValue({ data: [] })
    listClientsMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 200 })
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('renders the section header', async () => {
    listBankLoginsMock.mockResolvedValue(sampleLogins)
    render(<BankAccountsScreen />, { wrapper })
    expect(screen.getByText('Bank Accounts')).toBeInTheDocument()
    expect(screen.getByText('All client logins')).toBeInTheDocument()
  })

  it('renders the table with one row per login', async () => {
    listBankLoginsMock.mockResolvedValue(sampleLogins)
    render(<BankAccountsScreen />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Acme LLC')).toBeInTheDocument()
      expect(screen.getByText('Chase')).toBeInTheDocument()
    })
  })

  it('renders empty state when no logins', async () => {
    listBankLoginsMock.mockResolvedValue({
      items: [],
      total: 0,
      limit: 200,
      offset: 0,
    })
    render(<BankAccountsScreen />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText(/No bank logins yet/i)).toBeInTheDocument()
    })
  })

  it('renders error state on query failure', async () => {
    listBankLoginsMock.mockRejectedValue(new Error('boom'))
    render(<BankAccountsScreen />, { wrapper })
    await waitFor(() => {
      expect(
        screen.getByText(/Could not load bank logins/i),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
