import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useUpdateBankAccount } from './use-update-bank-account'

const updateBankAccountMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  updateBankAccount: (...args: unknown[]) => updateBankAccountMock(...args),
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
  const m = useUpdateBankAccount()
  return (
    <button
      type="button"
      onClick={() => m.mutate({ accountId: 'a-1', body: { label: 'Primary' } })}
    >
      Update
    </button>
  )
}

describe('useUpdateBankAccount', () => {
  beforeEach(() => {
    updateBankAccountMock.mockReset()
    toastSuccessMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls updateBankAccount and invalidates accounts namespace', async () => {
    updateBankAccountMock.mockResolvedValue({ id: 'a-1' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => {
      expect(updateBankAccountMock).toHaveBeenCalledWith('a-1', { label: 'Primary' })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['bank-login-accounts'],
      })
      expect(toastSuccessMock).toHaveBeenCalledWith('Account updated')
    })
  })
})
