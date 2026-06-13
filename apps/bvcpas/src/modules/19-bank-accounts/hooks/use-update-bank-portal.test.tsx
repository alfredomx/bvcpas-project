import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useUpdateBankPortal } from './use-update-bank-portal'

const updateBankPortalMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/bank-accounts.api', () => ({
  updateBankPortal: (...args: unknown[]) => updateBankPortalMock(...args),
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
  const m = useUpdateBankPortal()
  return (
    <button
      type="button"
      onClick={() => m.mutate({ portalId: 'p-1', body: { name: 'Chase Bank' } })}
    >
      Save
    </button>
  )
}

describe('useUpdateBankPortal', () => {
  beforeEach(() => {
    updateBankPortalMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('updates a portal and invalidates the catalog', async () => {
    updateBankPortalMock.mockResolvedValue({ id: 'p-1' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe />, { wrapper })
    await userEvent.setup().click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(updateBankPortalMock).toHaveBeenCalledWith('p-1', { name: 'Chase Bank' })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bank-portals'] })
      expect(toastSuccessMock).toHaveBeenCalledWith('Portal updated')
    })
  })
})
