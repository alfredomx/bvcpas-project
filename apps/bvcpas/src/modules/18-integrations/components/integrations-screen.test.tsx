// Smoke test del <IntegrationsScreen> (v0.9.0, visual only).

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { IntegrationsScreen } from './integrations-screen'

vi.mock('sonner', () => ({
  toast: { message: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

describe('<IntegrationsScreen>', () => {
  it('renders the section header with kicker, title and description', () => {
    render(<IntegrationsScreen legalName="Acme Corp" />)
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(
      screen.getByText(/Add data sources for this client/),
    ).toBeInTheDocument()
  })

  it('renders at least one card with Disconnect and Check status buttons', () => {
    render(<IntegrationsScreen legalName="Acme Corp" />)
    expect(
      screen.getAllByRole('button', { name: /disconnect/i }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: /check status/i }).length,
    ).toBeGreaterThan(0)
  })

  it('renders the footer with + Add another integration', () => {
    render(<IntegrationsScreen legalName="Acme Corp" />)
    expect(
      screen.getByRole('button', { name: /add another integration/i }),
    ).toBeInTheDocument()
  })
})
