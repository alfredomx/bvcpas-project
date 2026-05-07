// Tests TDD-first de <ClientTabs> (v0.3.0, Bloque 6).
//
// Barra horizontal con los 8 tabs de TABS. La tab activa se determina
// por el último segmento de la URL (después de /clients/<clientId>/).
// Click en otra tab navega + guarda en localStorage como última tab
// del cliente.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ClientTabs } from './client-tabs'
import { TABS } from '../lib/tabs'

const pushMock = vi.fn()
const usePathnameMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock, prefetch: vi.fn() }),
  usePathname: () => usePathnameMock(),
}))

describe('<ClientTabs>', () => {
  beforeEach(() => {
    pushMock.mockReset()
    usePathnameMock.mockReset()
    usePathnameMock.mockReturnValue('/dashboard/clients/c-1/customer-support')
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all 8 tabs in the order defined by TABS', () => {
    render(<ClientTabs clientId="c-1" />)
    const labels = TABS.map((t) => t.label)
    const rendered = labels.map((label) => screen.getByRole('tab', { name: label }))
    rendered.forEach((el, i) => {
      expect(el).toHaveTextContent(labels[i])
    })
  })

  it('marks the tab matching the URL slug as active', () => {
    usePathnameMock.mockReturnValue('/dashboard/clients/c-1/1099')

    render(<ClientTabs clientId="c-1" />)

    expect(screen.getByRole('tab', { name: '1099' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Customer Support' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('navigates to /dashboard/clients/<id>/<slug> when a tab is clicked', async () => {
    render(<ClientTabs clientId="c-1" />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Reconciliations' }))

    expect(pushMock).toHaveBeenCalledWith('/dashboard/clients/c-1/reconciliations')
  })

  it('persists the clicked tab as last tab for the client in localStorage', async () => {
    render(<ClientTabs clientId="c-1" />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'W-9' }))

    expect(window.localStorage.getItem('bvcpas.lastTabByClient.c-1')).toBe('w9')
  })
})
