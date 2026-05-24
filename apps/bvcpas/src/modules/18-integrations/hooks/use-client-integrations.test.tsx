// Tests de useClientIntegrations (v0.1.0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useClientIntegrations } from './use-client-integrations'

const getClientIntegrationsMock = vi.fn()

vi.mock('../api/integrations.api', () => ({
  getClientIntegrations: (...args: unknown[]) =>
    getClientIntegrationsMock(...args),
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function Probe({ clientId }: { clientId: string }) {
  const q = useClientIntegrations(clientId)
  return (
    <div>
      <span data-testid="loading">{q.isLoading ? 'true' : 'false'}</span>
      <span data-testid="error">{q.isError ? 'true' : 'false'}</span>
      <span data-testid="count">{q.data?.connections.length ?? 0}</span>
      <span data-testid="legal-name">{q.data?.client.legalName ?? ''}</span>
    </div>
  )
}

describe('useClientIntegrations', () => {
  beforeEach(() => {
    getClientIntegrationsMock.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls getClientIntegrations with the clientId and exposes data', async () => {
    getClientIntegrationsMock.mockResolvedValue({
      client: { id: 'c-1', legalName: 'Acme LLC' },
      stats: {
        connected: 1,
        healthy: 1,
        needsAttention: 0,
        errors: 0,
        providersInUse: 1,
      },
      connections: [{ id: 'conn-1' }, { id: 'conn-2' }],
    })

    render(<Probe clientId="c-1" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
    })
    expect(getClientIntegrationsMock).toHaveBeenCalledWith('c-1')
    expect(screen.getByTestId('legal-name').textContent).toBe('Acme LLC')
  })

  it('exposes isError when api throws', async () => {
    getClientIntegrationsMock.mockRejectedValue(new Error('boom'))

    render(<Probe clientId="c-1" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('true')
    })
  })

  it('does not run query when clientId is empty', () => {
    render(<Probe clientId="" />, { wrapper })

    expect(getClientIntegrationsMock).not.toHaveBeenCalled()
  })
})
