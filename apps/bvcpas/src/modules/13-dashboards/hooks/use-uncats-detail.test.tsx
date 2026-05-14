// Tests del hook useUncatsDetail (v0.5.0, Bloque C).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useUncatsDetail } from './use-uncats-detail'
import type { UncatsDetailResponse } from '../api/uncats-detail.api'

const getUncatsDetailMock = vi.fn()

vi.mock('../api/uncats-detail.api', () => ({
  getUncatsDetail: (...args: unknown[]) => getUncatsDetailMock(...args),
}))

function makeResponse(): UncatsDetailResponse {
  return {
    period: { from: '2025-01-01', to: '2026-04-30' },
    client: {
      id: 'c-1',
      legal_name: 'Acme LLC',
      tier: 'silver',
      qbo_realm_id: '9000',
      primary_contact_name: 'Jane',
      primary_contact_email: 'jane@acme.com',
      transactions_filter: 'all',
      draft_email_enabled: true,
      cc_email: null,
    },
    followup: {
      status: 'awaiting_reply',
      sent_at: '2026-04-13T10:00:00.000Z',
      last_reply_at: null,
      last_fully_responded_at: null,
      internal_notes: null,
    },
    stats: {
      uncats_count: 26,
      amas_count: 4,
      responded_count: 0,
      progress_pct: 0,
      amount_total: '62600.00',
      last_synced_at: '2026-04-30T23:59:00.000Z',
      last_response_at: null,
      silent_streak_days: 95,
    },
    monthly: {
      previous_year_total: { uncats: 1, amas: 0 },
      by_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, uncats: 0, amas: 0 })),
    },
    public_link: null,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function Probe({ clientId }: { clientId: string }) {
  const { data, isLoading, isError } = useUncatsDetail(clientId)
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <span data-testid="error">{isError ? 'true' : 'false'}</span>
      <span data-testid="legal-name">{data?.client.legal_name ?? ''}</span>
    </div>
  )
}

describe('useUncatsDetail', () => {
  beforeEach(() => {
    getUncatsDetailMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls api with the computed range and exposes data', async () => {
    getUncatsDetailMock.mockResolvedValue(makeResponse())

    render(<Probe clientId="c-1" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('legal-name').textContent).toBe('Acme LLC')
    })
    // El range concreto depende de "now"; sólo validamos la forma.
    expect(getUncatsDetailMock).toHaveBeenCalledTimes(1)
    const [calledClientId, params] = getUncatsDetailMock.mock.calls[0]
    expect(calledClientId).toBe('c-1')
    expect(params).toMatchObject({
      from: expect.stringMatching(/^\d{4}-01-01$/),
      to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })

  it('exposes isError=true on rejected api', async () => {
    getUncatsDetailMock.mockRejectedValue(new Error('boom'))

    render(<Probe clientId="c-1" />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('true')
    })
  })
})
