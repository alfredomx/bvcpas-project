// Tests de <CsConfigSheet> (v0.5.2, Bloque D).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { CsConfigSheet } from './cs-config-sheet'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

const updateClientMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('@/modules/11-clients/api/clients.api', () => ({
  updateClient: (...args: unknown[]) => updateClientMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    message: vi.fn(),
  },
}))

const sampleClient: UncatsDetailResponse['client'] = {
  id: 'c-1',
  legal_name: 'Acme LLC',
  tier: 'gold',
  qbo_realm_id: '9000',
  primary_contact_name: 'Jane',
  primary_contact_email: 'jane@acme.com',
  transactions_filter: 'all',
  draft_email_enabled: true,
  cc_email: null,
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('<CsConfigSheet>', () => {
  beforeEach(() => {
    updateClientMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders with the current client values when open', () => {
    render(
      <CsConfigSheet open={true} onOpenChange={() => {}} client={sampleClient} />,
      { wrapper },
    )

    expect(screen.getByLabelText(/contact name/i)).toHaveValue('Jane')
    expect(screen.getByLabelText(/contact email/i)).toHaveValue('jane@acme.com')
    expect(screen.getByLabelText(/cc email/i)).toHaveValue('')
    expect(screen.getByLabelText(/all \(expense \+ income\)/i)).toBeChecked()
  })

  it('submits PATCH with edited values, mapping empty strings to null', async () => {
    updateClientMock.mockResolvedValue({
      ...sampleClient,
      transactions_filter: 'expense',
    })
    const onOpenChange = vi.fn()

    render(
      <CsConfigSheet open={true} onOpenChange={onOpenChange} client={sampleClient} />,
      { wrapper },
    )

    const user = userEvent.setup()

    // Switch filter to expense.
    await user.click(screen.getByLabelText(/expense only/i))

    // Set ccEmail.
    const ccInput = screen.getByLabelText(/cc email/i)
    await user.type(ccInput, 'lorena@bv-cpas.com')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateClientMock).toHaveBeenCalledTimes(1)
    })
    const [, body] = updateClientMock.mock.calls[0]
    expect(body).toEqual({
      primaryContactName: 'Jane',
      primaryContactEmail: 'jane@acme.com',
      ccEmail: 'lorena@bv-cpas.com',
      transactionsFilter: 'expense',
      draftEmailEnabled: true,
    })
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('rejects invalid email and does not call api', async () => {
    render(
      <CsConfigSheet open={true} onOpenChange={() => {}} client={sampleClient} />,
      { wrapper },
    )

    const user = userEvent.setup()
    const ccInput = screen.getByLabelText(/cc email/i)
    await user.type(ccInput, 'not-an-email')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText(/correos válidos/i)).toBeInTheDocument()
    })
    expect(updateClientMock).not.toHaveBeenCalled()
  })

  it('accepts multiple emails separated by comma in ccEmail', async () => {
    updateClientMock.mockResolvedValue({ ...sampleClient })
    render(
      <CsConfigSheet open={true} onOpenChange={() => {}} client={sampleClient} />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText(/cc email/i),
      'lorena@bv-cpas.com, ileana@bv-cpas.com',
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateClientMock).toHaveBeenCalledTimes(1)
    })
    const [, body] = updateClientMock.mock.calls[0]
    expect(body.ccEmail).toBe('lorena@bv-cpas.com, ileana@bv-cpas.com')
  })

  it('normalizes whitespace around commas', async () => {
    updateClientMock.mockResolvedValue({ ...sampleClient })
    render(
      <CsConfigSheet open={true} onOpenChange={() => {}} client={sampleClient} />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText(/cc email/i),
      '  a@b.com  ,c@d.com,   e@f.com  ',
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateClientMock).toHaveBeenCalledTimes(1)
    })
    const [, body] = updateClientMock.mock.calls[0]
    expect(body.ccEmail).toBe('a@b.com, c@d.com, e@f.com')
  })

  it('rejects when one of the CSV emails is invalid', async () => {
    render(
      <CsConfigSheet open={true} onOpenChange={() => {}} client={sampleClient} />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText(/cc email/i),
      'a@b.com, not-email, c@d.com',
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText(/correos válidos/i)).toBeInTheDocument()
    })
    expect(updateClientMock).not.toHaveBeenCalled()
  })

  it('shows error toast on api rejection', async () => {
    updateClientMock.mockRejectedValue(new Error('boom'))
    render(
      <CsConfigSheet open={true} onOpenChange={() => {}} client={sampleClient} />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1)
    })
  })

  it('cancel closes the sheet without saving', async () => {
    const onOpenChange = vi.fn()
    render(
      <CsConfigSheet open={true} onOpenChange={onOpenChange} client={sampleClient} />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(updateClientMock).not.toHaveBeenCalled()
  })
})
