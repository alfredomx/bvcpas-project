import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { BankAccountsScreen } from './bank-accounts-screen'

function globalLogin(
  over: Partial<{ id: string; client: string; portal: string; status: string }> = {},
) {
  return {
    id: over.id ?? 'cred-1',
    client: { id: 'c-1', legal_name: over.client ?? 'Acme LLC' },
    portal: { id: 'p-1', name: over.portal ?? 'Chase', portal_url: null },
    username: 'jdoe',
    password: 's3cret',
    security_qa: null,
    status: over.status ?? 'active',
    notes: null,
    created_at: '',
    updated_at: '',
  }
}

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

  it('runs a global search and enters global mode (combo locked, Limpiar shown)', async () => {
    listBankAccountsMock.mockResolvedValue({ data: [] })
    listBankLoginsMock.mockResolvedValue({
      items: [globalLogin()],
      total: 1,
      limit: 200,
      offset: 0,
    })

    render(<BankAccountsScreen />, { wrapper })
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'chase')
    await user.click(screen.getByRole('button', { name: /buscar/i }))

    await waitFor(() => {
      expect(listBankLoginsMock).toHaveBeenCalledWith({ search: 'chase' })
      expect(screen.getByText('Acme LLC')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /select a client/i })).toBeDisabled()
  })

  it('clears the global search and re-enables client selection', async () => {
    listBankAccountsMock.mockResolvedValue({ data: [] })
    listBankLoginsMock.mockResolvedValue({
      items: [globalLogin()],
      total: 1,
      limit: 200,
      offset: 0,
    })

    render(<BankAccountsScreen />, { wrapper })
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'chase')
    await user.click(screen.getByRole('button', { name: /buscar/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: /limpiar/i }))
    expect(screen.getByText(/select a client to view their bank logins/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /select a client/i })).not.toBeDisabled()
  })

  it('filters the visible results by status', async () => {
    listBankAccountsMock.mockResolvedValue({ data: [] })
    listBankLoginsMock.mockResolvedValue({
      items: [
        globalLogin({ id: 'c1', portal: 'Chase', status: 'active' }),
        globalLogin({ id: 'c2', client: 'Beta Inc', portal: 'Wells Fargo', status: 'blocked' }),
      ],
      total: 2,
      limit: 200,
      offset: 0,
    })

    render(<BankAccountsScreen />, { wrapper })
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'a')
    await user.click(screen.getByRole('button', { name: /buscar/i }))
    await waitFor(() => expect(screen.getByText('Chase')).toBeInTheDocument())
    expect(screen.getByText('Wells Fargo')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Status'))
    await user.click(await screen.findByRole('option', { name: 'Blocked' }))

    expect(screen.queryByText('Chase')).not.toBeInTheDocument()
    expect(screen.getByText('Wells Fargo')).toBeInTheDocument()
  })
})
