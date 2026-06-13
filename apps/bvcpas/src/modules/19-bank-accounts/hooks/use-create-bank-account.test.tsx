import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useCreateBankAccount } from './use-create-bank-account'

const createBankAccountMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  createBankAccount: (...args: unknown[]) => createBankAccountMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccessMock(...a),
    error: (...a: unknown[]) => toastErrorMock(...a),
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function Probe() {
  const m = useCreateBankAccount()
  return (
    <button
      type="button"
      onClick={() =>
        m.mutate({
          credentialId: 'cred-1',
          body: { accountMask: '4242', accountType: 'checking' },
        })
      }
    >
      Add
    </button>
  )
}

describe('useCreateBankAccount', () => {
  beforeEach(() => {
    createBankAccountMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls createBankAccount and invalidates accounts list', async () => {
    createBankAccountMock.mockResolvedValue({ id: 'a-1' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /add/i }))

    await waitFor(() => {
      expect(createBankAccountMock).toHaveBeenCalledWith('cred-1', {
        accountMask: '4242',
        accountType: 'checking',
      })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['bank-login-accounts', 'cred-1'],
      })
      expect(toastSuccessMock).toHaveBeenCalledWith('Account added')
    })
  })
})
