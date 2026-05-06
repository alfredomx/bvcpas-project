// Tests TDD-first de <AppShell> (v0.3.0, Bloque 7).
//
// Orquestador puro: monta Sidebar + Topbar + main con children.
// La lógica de sesión y guard NO vive aquí — la maneja
// (authenticated)/layout.tsx que envuelve a <AppShell>.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { AppShell } from './app-shell'

vi.mock('@/modules/13-dashboards/api/customer-support.api', () => ({
  listClientsForSidebar: vi.fn().mockResolvedValue({
    period: { from: '2025-01-01', to: '2026-04-30' },
    items: [],
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/dashboard',
}))

vi.mock('@/modules/10-core-auth/hooks/use-session', () => ({
  useSession: () => ({
    user: {
      id: 'u-1',
      email: 'a@b.com',
      fullName: 'Alfredo Guerrero',
      role: 'admin',
      status: 'active',
    },
    accessToken: 'tok',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), message: vi.fn() },
}))

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('<AppShell>', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children inside the main region', () => {
    render(
      <AppShell>
        <div data-testid="content">protected page</div>
      </AppShell>,
      { wrapper },
    )

    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(screen.getByTestId('content').textContent).toBe('protected page')
  })

  it('renders the topbar with the user fullName', () => {
    render(
      <AppShell>
        <div />
      </AppShell>,
      { wrapper },
    )

    expect(screen.getByText('Alfredo Guerrero')).toBeInTheDocument()
  })

  it('renders the sidebar (search input is present)', () => {
    render(
      <AppShell>
        <div />
      </AppShell>,
      { wrapper },
    )

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })
})
