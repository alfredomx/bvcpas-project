// Tests del hook useClients (v0.4.0, Bloque 2).
//
// Responsabilidades del hook:
// - Llama listClients() (api wrapper).
// - Ordena items alfabéticamente por legal_name (case-insensitive).
// - Expone { items, isLoading, isError }.
//
// Estrategia: Probe + QueryClientProvider dedicado por test.
// vi.mock del api wrapper.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useClients } from './use-clients'
import type { Client, ClientsListResponse } from '../api/clients.api'

const listClientsMock = vi.fn()

vi.mock('../api/clients.api', () => ({
  listClients: (...args: unknown[]) => listClientsMock(...args),
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
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function Probe() {
  const { items, isLoading, isError } = useClients()
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <span data-testid="error">{isError ? 'true' : 'false'}</span>
      <span data-testid="count">{items.length}</span>
      <ol data-testid="names">
        {items.map((it) => (
          <li key={it.id}>{it.legal_name}</li>
        ))}
      </ol>
    </div>
  )
}

describe('useClients', () => {
  beforeEach(() => {
    listClientsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes items array on success', async () => {
    listClientsMock.mockResolvedValue(
      makeResponse([makeClient('Acme'), makeClient('Bravo'), makeClient('Charlie')]),
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
      makeResponse([
        makeClient('Charlie'),
        makeClient('acme'),
        makeClient('Bravo'),
        makeClient('elite'),
      ]),
    )

    render(<Probe />, { wrapper })

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('4'))

    const names = Array.from(screen.getByTestId('names').querySelectorAll('li')).map(
      (li) => li.textContent,
    )
    expect(names).toEqual(['acme', 'Bravo', 'Charlie', 'elite'])
  })

  it('isLoading=true while api in flight, false after resolve', async () => {
    let resolveFn: ((value: ClientsListResponse) => void) | undefined
    listClientsMock.mockImplementation(
      () =>
        new Promise<ClientsListResponse>((resolve) => {
          resolveFn = resolve
        }),
    )

    render(<Probe />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('true')
    })
    expect(screen.getByTestId('count').textContent).toBe('0')

    resolveFn?.(makeResponse([makeClient('X')]))

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
