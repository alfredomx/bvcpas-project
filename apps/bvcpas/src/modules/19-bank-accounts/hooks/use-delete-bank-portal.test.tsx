import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useDeleteBankPortal } from './use-delete-bank-portal'

const deleteBankPortalMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  deleteBankPortal: (...args: unknown[]) => deleteBankPortalMock(...args),
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
  const m = useDeleteBankPortal()
  return (
    <button type="button" onClick={() => m.mutate('p-1')}>
      Delete
    </button>
  )
}

describe('useDeleteBankPortal', () => {
  beforeEach(() => {
    deleteBankPortalMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('deletes a portal and invalidates the catalog', async () => {
    deleteBankPortalMock.mockResolvedValue(undefined)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(deleteBankPortalMock).toHaveBeenCalledWith('p-1')
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bank-portals'] })
      expect(toastSuccessMock).toHaveBeenCalledWith('Portal deleted')
    })
  })

  it('toasts error when the portal is in use', async () => {
    deleteBankPortalMock.mockRejectedValue(new Error('in use'))

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Could not delete portal (it may be in use by a login)',
      )
    })
  })
})
