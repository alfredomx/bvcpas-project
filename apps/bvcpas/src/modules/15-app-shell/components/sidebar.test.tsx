// Tests TDD-first de <Sidebar> (v0.3.0, Bloque 4b).
// Migrado en v0.4.0: ahora consume `useClients` del módulo 11-clients
// (D-bvcpas-027) en vez del antiguo `useClientsList` de 13-dashboards.
//
// Responsabilidades:
// - Skeleton mientras useClients está loading.
// - Renderiza una fila por cliente devuelto.
// - Search local filtra cliente-side por legal_name (case-insensitive).
// - Highlight (active) en la fila cuya URL matchea el clientId actual.
// - Click en fila navega a /dashboard/clients/<id>/uncategorized-transactions.
// - Filtro "All" presente (visualmente) — único filtro por ahora.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { Sidebar } from './sidebar'
import type { Client, ClientsListResponse } from '@/modules/11-clients/api/clients.api'

// Mock del api wrapper que useClients consume.
const listClientsMock = vi.fn()

vi.mock('@/modules/11-clients/api/clients.api', () => ({
  listClients: (...args: unknown[]) => listClientsMock(...args),
}))

// Mock router de Next.
const pushMock = vi.fn()
const useParamsMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock, prefetch: vi.fn() }),
  useParams: () => useParamsMock(),
}))

// Mock de react-virtual: en JSDOM no hay layout, así que devolvemos
// todos los items como "virtuales" sin medición real. La virtualización
// real se valida en runtime / smoke test manual, no en este unit test.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 36,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 36,
        end: (index + 1) * 36,
        key: index,
        size: 36,
        lane: 0,
      })),
  }),
}))

function makeClient(name: string, id?: string): Client {
  return {
    id: id ?? `c-${name.replace(/\s+/g, '-').toLowerCase()}`,
    legal_name: name,
    dba: null,
    qbo_realm_id: null,
    industry: null,
    entity_type: null,
    fiscal_year_start: null,
    timezone: null,
    status: 'active',
    tier: 'silver',
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null,
    metadata: null,
    draft_email_enabled: true,
    transactions_filter: 'all',
    cc_email: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeResponse(items: Client[]): ClientsListResponse {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 50,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('<Sidebar>', () => {
  beforeEach(() => {
    listClientsMock.mockReset()
    pushMock.mockReset()
    useParamsMock.mockReset()
    useParamsMock.mockReturnValue({})
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows skeleton while loading', async () => {
    // Promesa pendiente → loading=true.
    listClientsMock.mockImplementation(() => new Promise(() => {}))

    render(<Sidebar />, { wrapper })

    expect(screen.getByTestId('sidebar-skeleton')).toBeInTheDocument()
  })

  it('renders one row per client when loaded', async () => {
    listClientsMock.mockResolvedValue(
      makeResponse([makeClient('Acme'), makeClient('Bravo'), makeClient('Charlie')]),
    )

    render(<Sidebar />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument()
      expect(screen.getByText('Bravo')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    })
  })

  it('filters rows by search input (case-insensitive)', async () => {
    listClientsMock.mockResolvedValue(
      makeResponse([makeClient('Elite Fence'), makeClient('Acme'), makeClient('Bravo')]),
    )

    render(<Sidebar />, { wrapper })

    await waitFor(() => expect(screen.getByText('Elite Fence')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/search/i), 'eli')

    expect(screen.getByText('Elite Fence')).toBeInTheDocument()
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument()
  })

  it('navigates to /dashboard/clients/<id>/uncategorized-transactions on row click', async () => {
    listClientsMock.mockResolvedValue(makeResponse([makeClient('Acme', 'c-acme')]))

    render(<Sidebar />, { wrapper })

    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /acme/i }))

    expect(pushMock).toHaveBeenCalledWith('/dashboard/clients/c-acme/uncategorized-transactions')
  })

  it('marks the row matching useParams().clientId as active', async () => {
    useParamsMock.mockReturnValue({ clientId: 'c-bravo' })
    listClientsMock.mockResolvedValue(
      makeResponse([makeClient('Acme', 'c-acme'), makeClient('Bravo', 'c-bravo')]),
    )

    render(<Sidebar />, { wrapper })

    await waitFor(() => expect(screen.getByText('Bravo')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /bravo/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /acme/i })).not.toHaveAttribute('aria-current')
  })

  it('renders an "All" filter label as the only filter', async () => {
    listClientsMock.mockResolvedValue(makeResponse([makeClient('Acme')]))

    render(<Sidebar />, { wrapper })

    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument())

    expect(screen.getByText(/^all\b/i)).toBeInTheDocument()
  })

  it('collapses to <SidebarCollapsed> when the collapse button is clicked', async () => {
    listClientsMock.mockResolvedValue(makeResponse([makeClient('Acme')]))

    render(<Sidebar />, { wrapper })
    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))

    // En modo colapsado: la fila ya no es visible y el botón de expandir aparece.
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()
  })

  it('expands again when the expand button is clicked', async () => {
    window.localStorage.setItem('bvcpas.sidebarCollapsed', 'true')
    listClientsMock.mockResolvedValue(makeResponse([makeClient('Acme')]))

    render(<Sidebar />, { wrapper })

    // Arranca colapsada por el localStorage.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /expand sidebar/i }))

    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument())
  })
})
