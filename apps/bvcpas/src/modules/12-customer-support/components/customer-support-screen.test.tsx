// Tests del orquestador (v0.5.0, Bloque E).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { CustomerSupportScreen } from './customer-support-screen'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

const getUncatsDetailMock = vi.fn()

vi.mock('@/modules/13-dashboards/api/uncats-detail.api', () => ({
  getUncatsDetail: (...args: unknown[]) => getUncatsDetailMock(...args),
}))

vi.mock('sonner', () => ({
  toast: { message: vi.fn(), error: vi.fn() },
}))

function makeResponse(): UncatsDetailResponse {
  return {
    period: { from: '2025-01-01', to: '2026-04-30' },
    client: {
      id: 'c-1',
      legal_name: 'Acme LLC',
      tier: 'gold',
      qbo_realm_id: '9000',
      primary_contact_name: 'Jane',
      primary_contact_email: 'jane@acme.com',
      transactions_filter: 'all',
      draft_email_enabled: true,
      cc_email: null,
    },
    followup: {
      status: 'pending',
      sent_at: null,
      last_reply_at: null,
      internal_notes: null,
    },
    stats: {
      uncats_count: 10,
      amas_count: 2,
      responded_count: 0,
      progress_pct: 0,
      amount_total: '15000.00',
      last_synced_at: null,
      silent_streak_days: 0,
    },
    monthly: {
      previous_year_total: { uncats: 0, amas: 0 },
      by_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, uncats: 0, amas: 0 })),
    },
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('<CustomerSupportScreen>', () => {
  beforeEach(() => {
    getUncatsDetailMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    getUncatsDetailMock.mockImplementation(() => new Promise(() => {}))
    render(<CustomerSupportScreen clientId="c-1" />, { wrapper })
    expect(screen.getByTestId('cs-screen-loading')).toBeInTheDocument()
  })

  it('renders the screen with data on success', async () => {
    getUncatsDetailMock.mockResolvedValue(makeResponse())
    render(<CustomerSupportScreen clientId="c-1" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Acme LLC')).toBeInTheDocument()
    })
    expect(screen.getByText('$15.0k')).toBeInTheDocument()
    expect(screen.getByText("AMA's")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /draft follow-up/i })).toBeInTheDocument()
  })

  it('renders error state when api rejects', async () => {
    getUncatsDetailMock.mockRejectedValue(new Error('boom'))
    render(<CustomerSupportScreen clientId="c-1" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('cs-screen-error')).toBeInTheDocument()
    })
  })
})
