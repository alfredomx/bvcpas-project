// Tests de useResumeConnection (v0.1.0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useResumeConnection } from './use-resume-connection'

const resumeConnectionMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('../api/integrations.api', () => ({
  resumeConnection: (...args: unknown[]) => resumeConnectionMock(...args),
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
  const m = useResumeConnection()
  return (
    <button type="button" onClick={() => m.mutate(id)}>
      Resume
    </button>
  )
}

describe('useResumeConnection', () => {
  beforeEach(() => {
    resumeConnectionMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls resumeConnection with the id', async () => {
    resumeConnectionMock.mockResolvedValue(undefined)

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /resume/i }))

    await waitFor(() => {
      expect(resumeConnectionMock).toHaveBeenCalledWith('conn-1')
    })
  })

  it('invalidates client-integrations queries on success', async () => {
    resumeConnectionMock.mockResolvedValue(undefined)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /resume/i }))

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['client-integrations'],
      })
    })
  })

  it('shows success toast on success', async () => {
    resumeConnectionMock.mockResolvedValue(undefined)

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /resume/i }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Connection resumed')
    })
  })

  it('shows error toast on failure', async () => {
    resumeConnectionMock.mockRejectedValue(new Error('boom'))

    render(<Probe id="conn-1" />, { wrapper })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /resume/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Could not resume connection')
    })
  })
})
