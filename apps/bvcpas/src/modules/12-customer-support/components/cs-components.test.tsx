// Tests de los 5 sub-componentes presentacionales (v0.5.0, Bloque D).
// Verifican que reciben data por props y renderizan sin lógica de
// fetching. Click sobre placeholders dispara toast.

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

import { CsHeader } from './cs-header'
import { CsStatsGrid } from './cs-stats-grid'
import { CsSuggestedAction } from './cs-suggested-action'
import { CsQuickLinks } from './cs-quick-links'
import { CsActivityTimeline } from './cs-activity-timeline'

const toastMessageMock = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    message: (...args: unknown[]) => toastMessageMock(...args),
    error: vi.fn(),
  },
}))

const sample: UncatsDetailResponse = {
  period: { from: '2025-01-01', to: '2026-04-30' },
  client: {
    id: 'c-1',
    legal_name: 'Elite Fence & Welding, LLC',
    tier: 'platinum',
    qbo_realm_id: '9000',
    primary_contact_name: 'Hector Zavala',
    primary_contact_email: 'hector@elite.com',
    transactions_filter: 'all',
    draft_email_enabled: true,
    cc_email: null,
  },
  followup: {
    status: 'awaiting_reply',
    sent_at: '2026-04-13T10:00:00.000Z',
    last_reply_at: null,
    internal_notes: null,
  },
  stats: {
    uncats_count: 26,
    amas_count: 4,
    responded_count: 0,
    progress_pct: 0,
    amount_total: '62600.00',
    last_synced_at: '2026-04-30T23:59:00.000Z',
    silent_streak_days: 95,
  },
  monthly: {
    previous_year_total: { uncats: 1, amas: 0 },
    by_month: [
      { month: 1, uncats: 16, amas: 0 },
      { month: 2, uncats: 7, amas: 0 },
      { month: 3, uncats: 2, amas: 0 },
      { month: 4, uncats: 0, amas: 0 },
      { month: 5, uncats: 0, amas: 0 },
      { month: 6, uncats: 0, amas: 0 },
      { month: 7, uncats: 0, amas: 0 },
      { month: 8, uncats: 0, amas: 0 },
      { month: 9, uncats: 0, amas: 0 },
      { month: 10, uncats: 0, amas: 0 },
      { month: 11, uncats: 0, amas: 0 },
      { month: 12, uncats: 0, amas: 0 },
    ],
  },
}

describe('<CsHeader>', () => {
  it('renders legal name + contact + tier + followup status', () => {
    render(<CsHeader client={sample.client} followup={sample.followup} />)
    expect(screen.getByText('Elite Fence & Welding, LLC')).toBeInTheDocument()
    expect(screen.getByText(/Hector Zavala/)).toBeInTheDocument()
    expect(screen.getByText(/PLATINUM/)).toBeInTheDocument()
    expect(screen.getByText(/awaiting reply/)).toBeInTheDocument()
  })
})

describe('<CsStatsGrid>', () => {
  it('renders the 6 KPIs with formatted values', () => {
    // now = 2026-05-09 → mes anterior = April.
    render(<CsStatsGrid stats={sample.stats} now={new Date('2026-05-09T12:00:00Z')} />)
    expect(screen.getByText('$62.6k')).toBeInTheDocument()
    expect(screen.getByText('Uncats April')).toBeInTheDocument()
    expect(screen.getByText('26')).toBeInTheDocument() // uncats_count
    expect(screen.getByText("AMA's")).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument() // total backlog 26+4
    expect(screen.getByText('0%')).toBeInTheDocument() // progress
    expect(screen.getByText('3mo')).toBeInTheDocument() // silent streak
  })
})

describe('<CsSuggestedAction>', () => {
  it('shows toast on click', async () => {
    toastMessageMock.mockReset()
    render(
      <CsSuggestedAction
        client={sample.client}
        followup={sample.followup}
        stats={sample.stats}
      />,
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /draft follow-up/i }))

    expect(toastMessageMock).toHaveBeenCalledTimes(1)
  })

  it('mentions the contact name in the message', () => {
    render(
      <CsSuggestedAction
        client={sample.client}
        followup={sample.followup}
        stats={sample.stats}
      />,
    )
    expect(screen.getByText(/Hector Zavala/)).toBeInTheDocument()
  })
})

describe('<CsQuickLinks>', () => {
  it('renders 6 buttons; click dispatches toast', async () => {
    toastMessageMock.mockReset()
    render(<CsQuickLinks />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)

    const user = userEvent.setup()
    await user.click(buttons[0])
    expect(toastMessageMock).toHaveBeenCalledTimes(1)
  })
})

describe('<CsActivityTimeline>', () => {
  it('renders 12 buckets and highlights the previous month', () => {
    render(
      <CsActivityTimeline monthly={sample.monthly} now={new Date('2026-05-09T12:00:00Z')} />,
    )
    // Cada bucket trae aria-label con "MonthName N uncats".
    expect(screen.getByLabelText(/January 16 uncats/)).toBeInTheDocument()
    expect(screen.getByLabelText(/April 0 uncats/)).toBeInTheDocument()
    // Highlighted month figura en el título superior.
    expect(screen.getByText(/April highlighted/)).toBeInTheDocument()
  })
})
