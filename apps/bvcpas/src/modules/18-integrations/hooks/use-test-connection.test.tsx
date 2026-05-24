// Tests de useTestConnection (v0.1.0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useTestConnection } from './use-test-connection'

const testConnectionMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/integrations.api', () => ({
  testConnection: (...args: unknown[]) => testConnectionMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function Probe({ id }: { id: string }) {
  const m = useTestConnection()
  return (
    <button type="button" onClick={() => m.mutate(id)}>
      Check
    </button>
  )
}

describe('useTestConnection', () => {
  beforeEach(() => {
    testConnectionMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls testConnection with the id', async () => {
    testConnectionMock.mockResolvedValue({ ok: true, message: 'All good' })

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /check/i }))

    await waitFor(() => {
      expect(testConnectionMock).toHaveBeenCalledWith('conn-1')
    })
  })

  it('shows success toast with the response message', async () => {
    testConnectionMock.mockResolvedValue({
      ok: true,
      message: 'Token valid · 4ms',
    })

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /check/i }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Token valid · 4ms')
    })
  })

  it('does NOT invalidate queries (health-check is read-only)', async () => {
    testConnectionMock.mockResolvedValue({ ok: true, message: 'ok' })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /check/i }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalled()
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('shows error toast on failure', async () => {
    testConnectionMock.mockRejectedValue(new Error('boom'))

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /check/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Connection check failed')
    })
  })
})
