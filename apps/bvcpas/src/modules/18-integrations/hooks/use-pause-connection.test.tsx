// Tests de usePauseConnection (v0.1.0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { usePauseConnection } from './use-pause-connection'

const pauseConnectionMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/integrations.api', () => ({
  pauseConnection: (...args: unknown[]) => pauseConnectionMock(...args),
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

function Probe({ id, reason }: { id: string; reason?: string }) {
  const m = usePauseConnection()
  return (
    <button type="button" onClick={() => m.mutate({ id, reason })}>
      Pause
    </button>
  )
}

describe('usePauseConnection', () => {
  beforeEach(() => {
    pauseConnectionMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls pauseConnection with id and reason', async () => {
    pauseConnectionMock.mockResolvedValue(undefined)

    render(<Probe id="conn-1" reason="vacation" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /pause/i }))

    await waitFor(() => {
      expect(pauseConnectionMock).toHaveBeenCalledWith('conn-1', 'vacation')
    })
  })

  it('invalidates client-integrations queries on success', async () => {
    pauseConnectionMock.mockResolvedValue(undefined)
    queryClient.setQueryData(['client-integrations', 'c-1'], { stub: true })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /pause/i }))

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['client-integrations'],
      })
    })
  })

  it('shows success toast on success', async () => {
    pauseConnectionMock.mockResolvedValue(undefined)

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /pause/i }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Connection paused')
    })
  })

  it('shows error toast on failure', async () => {
    pauseConnectionMock.mockRejectedValue(new Error('boom'))

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /pause/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Could not pause connection')
    })
  })
})
