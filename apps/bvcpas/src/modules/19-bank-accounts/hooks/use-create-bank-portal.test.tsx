import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useCreateBankPortal } from './use-create-bank-portal'

const createBankPortalMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  createBankPortal: (...args: unknown[]) => createBankPortalMock(...args),
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
  const m = useCreateBankPortal()
  return (
    <button type="button" onClick={() => m.mutate({ name: 'Frost Bank', portalUrl: null })}>
      Add
    </button>
  )
}

describe('useCreateBankPortal', () => {
  beforeEach(() => {
    createBankPortalMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('creates a portal and invalidates the catalog', async () => {
    createBankPortalMock.mockResolvedValue({ id: 'p-9' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /add/i }))

    await waitFor(() => {
      expect(createBankPortalMock).toHaveBeenCalledWith({
        name: 'Frost Bank',
        portalUrl: null,
      })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bank-portals'] })
      expect(toastSuccessMock).toHaveBeenCalledWith('Portal added')
    })
  })

  it('toasts error on failure', async () => {
    createBankPortalMock.mockRejectedValue(new Error('boom'))

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /add/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Could not add portal')
    })
  })
})
