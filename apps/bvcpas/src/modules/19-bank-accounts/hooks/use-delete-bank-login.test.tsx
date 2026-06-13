import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useDeleteBankLogin } from './use-delete-bank-login'

const deleteBankLoginMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  deleteBankLogin: (...args: unknown[]) => deleteBankLoginMock(...args),
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
  const m = useDeleteBankLogin()
  return (
    <button type="button" onClick={() => m.mutate('cred-1')}>
      Delete
    </button>
  )
}

describe('useDeleteBankLogin', () => {
  beforeEach(() => {
    deleteBankLoginMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls deleteBankLogin and invalidates on success', async () => {
    deleteBankLoginMock.mockResolvedValue(undefined)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(deleteBankLoginMock).toHaveBeenCalledWith('cred-1')
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bank-logins'] })
      expect(toastSuccessMock).toHaveBeenCalledWith('Bank login deleted')
    })
  })
})
