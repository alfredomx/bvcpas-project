import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useChangeBankAccountStatus } from './use-change-bank-account-status'

const changeStatusMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  changeBankAccountStatus: (...args: unknown[]) => changeStatusMock(...args),
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
  const m = useChangeBankAccountStatus()
  return (
    <button
      type="button"
      onClick={() =>
        m.mutate({ accountId: 'a-1', body: { status: 'closed' } })
      }
    >
      Change
    </button>
  )
}

describe('useChangeBankAccountStatus', () => {
  beforeEach(() => {
    changeStatusMock.mockReset()
    toastSuccessMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls changeBankAccountStatus and invalidates accounts namespace', async () => {
    changeStatusMock.mockResolvedValue({ id: 'a-1' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /change/i }))

    await waitFor(() => {
      expect(changeStatusMock).toHaveBeenCalledWith('a-1', { status: 'closed' })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['bank-login-accounts'],
      })
      expect(toastSuccessMock).toHaveBeenCalledWith('Account status changed')
    })
  })
})
