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
const createPublicLinkMock = vi.fn()
const revokePublicLinkMock = vi.fn()
const updatePublicLinkMock = vi.fn()

vi.mock('@/modules/11-clients/api/clients.api', () => ({
  updateClient: (...args: unknown[]) => updateClientMock(...args),
}))

vi.mock('../api/public-links.api', () => ({
  createPublicLink: (...args: unknown[]) => createPublicLinkMock(...args),
  revokePublicLink: (...args: unknown[]) => revokePublicLinkMock(...args),
  updatePublicLink: (...args: unknown[]) => updatePublicLinkMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    message: vi.fn(),
  },
}))

const samplePublicLink: NonNullable<UncatsDetailResponse['public_link']> = {
  id: 'pl-1',
  token: 'tok_abc123',
  url: 'https://app.bvcpas.com/p/tok_abc123',
  label: null,
  max_uses: null,
  use_count: 0,
  expires_at: null,
  revoked_at: null,
  created_at: '2026-05-10T00:00:00.000Z',
}

const sampleRevokedLink: NonNullable<UncatsDetailResponse['public_link']> = {
  ...samplePublicLink,
  revoked_at: '2026-05-10T12:00:00.000Z',
}

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
    createPublicLinkMock.mockReset()
    revokePublicLinkMock.mockReset()
    updatePublicLinkMock.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders with the current client values when open', () => {
    render(
      <CsConfigSheet
        open={true}
        onOpenChange={() => {}}
        client={sampleClient}
        publicLink={null}
      />,
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
      <CsConfigSheet
        open={true}
        onOpenChange={onOpenChange}
        client={sampleClient}
        publicLink={null}
      />,
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
      <CsConfigSheet
        open={true}
        onOpenChange={() => {}}
        client={sampleClient}
        publicLink={null}
      />,
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
      <CsConfigSheet
        open={true}
        onOpenChange={() => {}}
        client={sampleClient}
        publicLink={null}
      />,
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
      <CsConfigSheet
        open={true}
        onOpenChange={() => {}}
        client={sampleClient}
        publicLink={null}
      />,
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
      <CsConfigSheet
        open={true}
        onOpenChange={() => {}}
        client={sampleClient}
        publicLink={null}
      />,
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
      <CsConfigSheet
        open={true}
        onOpenChange={() => {}}
        client={sampleClient}
        publicLink={null}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('public link section', () => {
    it('without public link: URL empty, only Generate button, no switch/Copy', () => {
      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={null}
        />,
        { wrapper },
      )

      const urlInput = screen.getByLabelText(/public link url/i) as HTMLInputElement
      expect(urlInput.value).toBe('')
      expect(screen.queryByLabelText(/^enabled$/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /regenerate/i }),
      ).not.toBeInTheDocument()
    })

    it('with active link: URL filled, switch ON, Copy + Regenerate visible', () => {
      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={samplePublicLink}
        />,
        { wrapper },
      )

      const enabledSwitch = screen.getByLabelText(/^enabled$/i)
      expect(enabledSwitch).toBeChecked()
      const urlInput = screen.getByLabelText(/public link url/i) as HTMLInputElement
      expect(urlInput.value).toBe(samplePublicLink.url)
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
      expect(screen.getByText(/created/i)).toBeInTheDocument()
    })

    it('with revoked link: switch OFF; URL still visible', () => {
      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={sampleRevokedLink}
        />,
        { wrapper },
      )

      const enabledSwitch = screen.getByLabelText(/^enabled$/i)
      expect(enabledSwitch).not.toBeChecked()
      const urlInput = screen.getByLabelText(/public link url/i) as HTMLInputElement
      expect(urlInput.value).toBe(sampleRevokedLink.url)
    })

    it('Generate button: POSTs create (no force)', async () => {
      createPublicLinkMock.mockResolvedValue(samplePublicLink)
      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={null}
        />,
        { wrapper },
      )

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /generate/i }))

      await waitFor(() => {
        expect(createPublicLinkMock).toHaveBeenCalledTimes(1)
      })
      expect(createPublicLinkMock).toHaveBeenCalledWith('c-1', { force: undefined })
    })

    it('toggle ON→OFF: confirm dialog → revoke', async () => {
      revokePublicLinkMock.mockResolvedValue(undefined)
      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={samplePublicLink}
        />,
        { wrapper },
      )

      const user = userEvent.setup()
      await user.click(screen.getByLabelText(/^enabled$/i))

      expect(
        await screen.findByText(/disable public link/i),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /^disable$/i }))

      await waitFor(() => {
        expect(revokePublicLinkMock).toHaveBeenCalledTimes(1)
      })
      expect(revokePublicLinkMock).toHaveBeenCalledWith('c-1', 'pl-1')
    })

    it('toggle OFF→ON on revoked link: PATCH revokedAt:null', async () => {
      updatePublicLinkMock.mockResolvedValue(samplePublicLink)
      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={sampleRevokedLink}
        />,
        { wrapper },
      )

      const user = userEvent.setup()
      await user.click(screen.getByLabelText(/^enabled$/i))

      await waitFor(() => {
        expect(updatePublicLinkMock).toHaveBeenCalledTimes(1)
      })
      expect(updatePublicLinkMock).toHaveBeenCalledWith('c-1', 'pl-1', {
        revokedAt: null,
      })
    })

    it('Regenerate: confirm dialog → POST with force:true', async () => {
      createPublicLinkMock.mockResolvedValue(samplePublicLink)
      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={samplePublicLink}
        />,
        { wrapper },
      )

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /regenerate/i }))

      expect(
        await screen.findByText(/regenerate link\?/i),
      ).toBeInTheDocument()

      const dialog = screen.getByRole('alertdialog')
      const confirmBtn = await import('@testing-library/dom').then(({ within }) =>
        within(dialog).getByRole('button', { name: /^regenerate/i }),
      )
      await user.click(confirmBtn)

      await waitFor(() => {
        expect(createPublicLinkMock).toHaveBeenCalledTimes(1)
      })
      expect(createPublicLinkMock).toHaveBeenCalledWith('c-1', { force: true })
    })

    it('Copy: writes URL to clipboard and shows success toast', async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined)

      render(
        <CsConfigSheet
          open={true}
          onOpenChange={() => {}}
          client={sampleClient}
          publicLink={samplePublicLink}
        />,
        { wrapper },
      )

      const user = userEvent.setup()
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextSpy },
        configurable: true,
        writable: true,
      })

      await user.click(screen.getByRole('button', { name: /copy/i }))

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith(samplePublicLink.url)
      })
      expect(toastSuccessMock).toHaveBeenCalled()
    })
  })

  it('cancel closes the sheet without saving', async () => {
    const onOpenChange = vi.fn()
    render(
      <CsConfigSheet
        open={true}
        onOpenChange={onOpenChange}
        client={sampleClient}
        publicLink={null}
      />,
      { wrapper },
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(updateClientMock).not.toHaveBeenCalled()
  })
})
