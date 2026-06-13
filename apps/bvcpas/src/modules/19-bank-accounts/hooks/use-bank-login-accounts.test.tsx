import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useBankLoginAccounts } from './use-bank-login-accounts'

const listBankAccountsMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  listBankAccounts: (...args: unknown[]) => listBankAccountsMock(...args),
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function Probe({ credId }: { credId: string | null }) {
  const q = useBankLoginAccounts(credId)
  return (
    <div>
      <span data-testid="count">{q.data?.data.length ?? 0}</span>
    </div>
  )
}

describe('useBankLoginAccounts', () => {
  beforeEach(() => {
    listBankAccountsMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls listBankAccounts with credentialId', async () => {
    listBankAccountsMock.mockResolvedValue({ data: [{ id: 'a-1' }, { id: 'a-2' }] })

    render(<Probe credId="cred-1" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
      expect(listBankAccountsMock).toHaveBeenCalledWith('cred-1')
    })
  })

  it('does not run when credentialId is null', () => {
    render(<Probe credId={null} />, { wrapper })
    expect(listBankAccountsMock).not.toHaveBeenCalled()
  })
})
