// Tests TDD-first del hook useClientsList (v0.3.0, Bloque 3b).
//
// Responsabilidades del hook:
// - Calcula from = (currentYear - 1)-01-01 y to = último día del mes
//   anterior a "hoy" (regla del backend `13-dashboards`).
// - Llama al api wrapper listClientsForSidebar.
// - Ordena los items alfabéticamente por legal_name (case-insensitive).
// - Expone { items, isLoading, isError } sin filtrar; el resto es
//   responsabilidad del componente que lo consuma.
//
// Estrategia: render del hook con un Probe + QueryClientProvider
// dedicado para no compartir cache entre tests. Mockeamos el api
// wrapper con vi.mock.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useClientsList } from './use-clients-list'
import type { CustomerSupportListItem, CustomerSupportListResponse } from '../types'

// Mock del api wrapper. Cada test setea su retorno.
const listClientsMock = vi.fn()

vi.mock('../api/customer-support.api', () => ({
  listClientsForSidebar: (...args: unknown[]) => listClientsMock(...args),
}))

function makeItem(name: string, id = 'c-' + name): CustomerSupportListItem {
  return {
    client_id: id,
    legal_name: name,
    tier: 'silver',
    qbo_realm_id: '9000',
    followup: { status: 'pending', sent_at: null },
    stats: {
      uncats_count: 0,
      amas_count: 0,
      responded_count: 0,
      progress_pct: 0,
      amount_total: '0.00',
      last_synced_at: null,
    },
    monthly: {
      previous_year_total: { uncats: 0, amas: 0 },
      by_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, uncats: 0, amas: 0 })),
    },
  }
}

function makeResponse(items: CustomerSupportListItem[]): CustomerSupportListResponse {
  return {
    period: { from: '2025-01-01', to: '2026-04-30' },
    items,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  // QueryClient dedicado por test → no comparte cache.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// Probe expone los valores del hook al DOM.
function Probe() {
  const { items, isLoading, isError } = useClientsList()
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <span data-testid="error">{isError ? 'true' : 'false'}</span>
      <span data-testid="count">{items.length}</span>
      <ol data-testid="names">
        {items.map((it) => (
          <li key={it.client_id}>{it.legal_name}</li>
        ))}
      </ol>
    </div>
  )
}

describe('useClientsList', () => {
  beforeEach(() => {
    listClientsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls api with from = (currentYear-1)-01-01 and to = last day of previous month', async () => {
    // Calculamos las fechas esperadas a partir de "hoy real" — evita
    // chocar con fake timers (React Query usa setTimeout interno y se
    // cuelga cuando los timers están congelados). El test queda
    // determinístico aunque corra en cualquier mes/año.
    const now = new Date()
    const fromYear = now.getFullYear() - 1
    const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0)
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    const expectedFrom = `${fromYear}-01-01`
    const expectedTo = `${lastDayPrev.getFullYear()}-${pad(lastDayPrev.getMonth() + 1)}-${pad(lastDayPrev.getDate())}`

    listClientsMock.mockResolvedValue(makeResponse([]))

    render(<Probe />, { wrapper })

    await waitFor(() => {
      expect(listClientsMock).toHaveBeenCalledTimes(1)
    })
    expect(listClientsMock).toHaveBeenCalledWith({
      from: expectedFrom,
      to: expectedTo,
    })
  })

  it('exposes items array on success', async () => {
    listClientsMock.mockResolvedValue(
      makeResponse([makeItem('Acme'), makeItem('Bravo'), makeItem('Charlie')]),
    )

    render(<Probe />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('count').textContent).toBe('3')
    })
    expect(screen.getByTestId('error').textContent).toBe('false')
  })

  it('sorts items alphabetically by legal_name (case-insensitive)', async () => {
    listClientsMock.mockResolvedValue(
      makeResponse([makeItem('Charlie'), makeItem('acme'), makeItem('Bravo'), makeItem('elite')]),
    )

    render(<Probe />, { wrapper })

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('4'))

    const names = Array.from(screen.getByTestId('names').querySelectorAll('li')).map(
      (li) => li.textContent,
    )
    expect(names).toEqual(['acme', 'Bravo', 'Charlie', 'elite'])
  })

  it('isLoading=true while api in flight, false after resolve', async () => {
    let resolveFn: ((value: CustomerSupportListResponse) => void) | undefined
    listClientsMock.mockImplementation(
      () =>
        new Promise<CustomerSupportListResponse>((resolve) => {
          resolveFn = resolve
        }),
    )

    render(<Probe />, { wrapper })

    // Inicial: loading=true, items=[].
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('true')
    })
    expect(screen.getByTestId('count').textContent).toBe('0')

    // Resuelve la promesa.
    resolveFn?.(makeResponse([makeItem('X')]))

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('count').textContent).toBe('1')
    })
  })

  it('isError=true when api rejects', async () => {
    listClientsMock.mockRejectedValue(new Error('boom'))

    render(<Probe />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('true')
    })
    expect(screen.getByTestId('count').textContent).toBe('0')
  })
})
