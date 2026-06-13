import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('<BankAccountsScreen>', () => {
  beforeEach(() => {
    listBankLoginsMock.mockReset()
    listBankPortalsMock.mockReset()
    listClientsMock.mockReset()
    listBankAccountsMock.mockReset()
    listBankPortalsMock.mockResolvedValue({ data: [] })
    listClientsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 200,
    })
    listBankLoginsMock.mockResolvedValue({
      items: [],
      total: 0,
      limit: 200,
      offset: 0,
    })
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('renders the section header', () => {
    render(<BankAccountsScreen />, { wrapper })
    expect(screen.getByText('Bank Accounts')).toBeInTheDocument()
    expect(screen.getByText('Client bank logins')).toBeInTheDocument()
  })

  it('prompts to select a client before showing anything', () => {
    render(<BankAccountsScreen />, { wrapper })
    expect(screen.getByText(/select a client to view their bank logins/i)).toBeInTheDocument()
  })

  it('does not fetch bank logins until a client is selected', () => {
    render(<BankAccountsScreen />, { wrapper })
    expect(listBankLoginsMock).not.toHaveBeenCalled()
  })
})
