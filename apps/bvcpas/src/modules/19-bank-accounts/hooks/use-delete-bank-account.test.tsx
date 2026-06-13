import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useDeleteBankAccount } from './use-delete-bank-account'

const deleteBankAccountMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  deleteBankAccount: (...args: unknown[]) => deleteBankAccountMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccessMock(...a),
    error: vi.fn(),
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function Probe() {
  const m = useDeleteBankAccount()
  return (
    <button type="button" onClick={() => m.mutate('a-1')}>
      Delete
    </button>
  )
}

describe('useDeleteBankAccount', () => {
  beforeEach(() => {
    deleteBankAccountMock.mockReset()
    toastSuccessMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls deleteBankAccount and invalidates', async () => {
    deleteBankAccountMock.mockResolvedValue(undefined)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(deleteBankAccountMock).toHaveBeenCalledWith('a-1')
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['bank-login-accounts'],
      })
      expect(toastSuccessMock).toHaveBeenCalledWith('Account deleted')
    })
  })
})
