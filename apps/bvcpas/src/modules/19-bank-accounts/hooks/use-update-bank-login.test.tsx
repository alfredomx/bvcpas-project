import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useUpdateBankLogin } from './use-update-bank-login'

const updateBankLoginMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  updateBankLogin: (...args: unknown[]) => updateBankLoginMock(...args),
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
  const m = useUpdateBankLogin()
  return (
    <button
      type="button"
      onClick={() => m.mutate({ credentialId: 'cred-1', body: { password: 'newpw' } })}
    >
      Update
    </button>
  )
}

describe('useUpdateBankLogin', () => {
  beforeEach(() => {
    updateBankLoginMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('calls updateBankLogin and invalidates list + detail on success', async () => {
    updateBankLoginMock.mockResolvedValue({ id: 'cred-1' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => {
      expect(updateBankLoginMock).toHaveBeenCalledWith('cred-1', {
        password: 'newpw',
      })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bank-logins'] })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['bank-login', 'cred-1'],
      })
      expect(toastSuccessMock).toHaveBeenCalledWith('Bank login updated')
    })
  })
})
