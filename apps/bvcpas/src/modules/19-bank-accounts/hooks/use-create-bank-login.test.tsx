import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useCreateBankLogin } from './use-create-bank-login'

const createBankLoginMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  createBankLogin: (...args: unknown[]) => createBankLoginMock(...args),
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
  const m = useCreateBankLogin()
  return (
    <button
      type="button"
      onClick={() =>
        m.mutate({
          clientId: 'c-1',
          bankPortalId: 'p-1',
          username: 'jdoe',
          password: 'secret',
        })
      }
    >
      Create
    </button>
  )
}

describe('useCreateBankLogin', () => {
  beforeEach(() => {
    createBankLoginMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls createBankLogin and invalidates list on success', async () => {
    createBankLoginMock.mockResolvedValue({ id: 'cred-1' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(createBankLoginMock).toHaveBeenCalledWith({
        clientId: 'c-1',
        bankPortalId: 'p-1',
        username: 'jdoe',
        password: 'secret',
      })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bank-logins'] })
      expect(toastSuccessMock).toHaveBeenCalledWith('Bank login created')
    })
  })

  it('shows error toast on failure', async () => {
    createBankLoginMock.mockRejectedValue(new Error('boom'))

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Could not create bank login')
    })
  })
})
