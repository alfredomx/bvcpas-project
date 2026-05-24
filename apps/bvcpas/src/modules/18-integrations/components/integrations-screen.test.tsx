// Smoke test del <IntegrationsScreen> conectado al backend (v0.1.0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { IntegrationsScreen } from './integrations-screen'

const getClientIntegrationsMock = vi.fn()
const pauseConnectionMock = vi.fn()
const resumeConnectionMock = vi.fn()
const testConnectionMock = vi.fn()

vi.mock('../api/integrations.api', () => ({
  getClientIntegrations: (...args: unknown[]) =>
    getClientIntegrationsMock(...args),
  pauseConnection: (...args: unknown[]) => pauseConnectionMock(...args),
  resumeConnection: (...args: unknown[]) => resumeConnectionMock(...args),
  testConnection: (...args: unknown[]) => testConnectionMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const sampleDashboard = {
  client: { id: 'c-1', legalName: 'Acme LLC' },
  stats: {
    connected: 2,
    healthy: 1,
    needsAttention: 1,
    errors: 0,
    providersInUse: 2,
  },
  connections: [
    {
      id: 'conn-1',
      provider: 'clover',
      providerLabel: 'Clover',
      label: 'Blanco To Go',
      externalAccountId: 'MQZZH',
      authType: 'api_key',
      status: 'healthy',
      statusReason: null,
      pausedAt: null,
      pausedReason: null,
      lastSyncAt: null,
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'conn-2',
      provider: 'square',
      providerLabel: 'Square',
      label: 'Hospice Retail',
      externalAccountId: 'LOC1',
      authType: 'oauth',
      status: 'paused',
      statusReason: null,
      pausedAt: '2026-05-10T00:00:00.000Z',
      pausedReason: null,
      lastSyncAt: null,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
  ],
}

describe('<IntegrationsScreen>', () => {
  beforeEach(() => {
    getClientIntegrationsMock.mockReset()
    pauseConnectionMock.mockReset()
    resumeConnectionMock.mockReset()
    testConnectionMock.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the section header with kicker, title and description', async () => {
    getClientIntegrationsMock.mockResolvedValue(sampleDashboard)

    render(
      <IntegrationsScreen clientId="c-1" legalName="Acme Corp" />,
      { wrapper },
    )

    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(
      screen.getByText(/Add data sources for this client/),
    ).toBeInTheDocument()
  })

  it('renders one card per connection with Pause/Resume + Check status', async () => {
    getClientIntegrationsMock.mockResolvedValue(sampleDashboard)

    render(
      <IntegrationsScreen clientId="c-1" legalName="Acme Corp" />,
      { wrapper },
    )

    await waitFor(() => {
      // conn-1 (healthy) shows Pause; conn-2 (paused) shows Resume
      expect(screen.getByRole('button', { name: /^pause$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^resume$/i })).toBeInTheDocument()
    })
    // Two cards, each with a Check status button. The card container
    // is also role="button" so we filter by exact name match.
    expect(
      screen.getAllByRole('button', { name: 'Check status' }),
    ).toHaveLength(2)
  })

  it('renders empty state when there are no connections', async () => {
    getClientIntegrationsMock.mockResolvedValue({
      ...sampleDashboard,
      connections: [],
    })

    render(
      <IntegrationsScreen clientId="c-1" legalName="Acme Corp" />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByText(/No integrations yet/i)).toBeInTheDocument()
    })
  })

  it('renders error state with retry button when query fails', async () => {
    getClientIntegrationsMock.mockRejectedValue(new Error('boom'))

    render(
      <IntegrationsScreen clientId="c-1" legalName="Acme Corp" />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByText(/Could not load integrations/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
