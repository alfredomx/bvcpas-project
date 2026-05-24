// Tests TDD-first de <ClientTabs> (v0.3.0, Bloque 6).
//
// Barra horizontal con los tabs de TABS. El primer tab `Home` apunta a
// la raíz `/dashboard/clients/<id>`; los demás tabs apuntan a
// `/dashboard/clients/<id>/<slug>`. La tab activa se determina por el
// pathname.

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

function tabByLabel(label: string): HTMLElement {
  // Accesible name del botón es el `label` + (opcional) badge. Usamos
  // matcher por texto del label que SIEMPRE aparece como primer span.
  // Buscamos por role tab y filtramos.
  const tabs = screen.getAllByRole('tab')
  const found = tabs.find((el) => el.textContent?.startsWith(label))
  if (!found) throw new Error(`Tab "${label}" not found`)
  return found
}

describe('<ClientTabs>', () => {
  beforeEach(() => {
    pushMock.mockReset()
    usePathnameMock.mockReset()
    usePathnameMock.mockReturnValue('/dashboard/clients/c-1/uncategorized-transactions')
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all tabs in the order defined by TABS', () => {
    render(<ClientTabs clientId="c-1" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(TABS.length)
    TABS.forEach((tab, i) => {
      expect(tabs[i].textContent).toContain(tab.label)
    })
  })

  it('shows the badge next to tabs that have one', () => {
    render(<ClientTabs clientId="c-1" />)
    const uncat = tabByLabel('Uncat. Transactions')
    expect(uncat.textContent).toContain('6')
  })

  it('marks Home as active when pathname is the client root', () => {
    usePathnameMock.mockReturnValue('/dashboard/clients/c-1')

    render(<ClientTabs clientId="c-1" />)

    expect(tabByLabel('Home')).toHaveAttribute('aria-selected', 'true')
    expect(tabByLabel('1099')).toHaveAttribute('aria-selected', 'false')
  })

  it('marks the tab matching the URL slug as active', () => {
    usePathnameMock.mockReturnValue('/dashboard/clients/c-1/1099')

    render(<ClientTabs clientId="c-1" />)

    expect(tabByLabel('1099')).toHaveAttribute('aria-selected', 'true')
    expect(tabByLabel('Home')).toHaveAttribute('aria-selected', 'false')
  })

  it('navigates to root /dashboard/clients/<id> when Home is clicked', async () => {
    render(<ClientTabs clientId="c-1" />)

    const user = userEvent.setup()
    await user.click(tabByLabel('Home'))

    expect(pushMock).toHaveBeenCalledWith('/dashboard/clients/c-1')
  })

  it('navigates to /dashboard/clients/<id>/<slug> when a non-Home tab is clicked', async () => {
    render(<ClientTabs clientId="c-1" />)

    const user = userEvent.setup()
    await user.click(tabByLabel('Reconciliations'))

    expect(pushMock).toHaveBeenCalledWith('/dashboard/clients/c-1/reconciliations')
  })

  it('persists the clicked non-Home tab as last tab in localStorage', async () => {
    render(<ClientTabs clientId="c-1" />)

    const user = userEvent.setup()
    await user.click(tabByLabel('W-9'))

    expect(window.localStorage.getItem('bvcpas.lastTabByClient.c-1')).toBe('w9')
  })
})
