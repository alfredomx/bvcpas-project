import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { BankPortal } from '../api/bank-accounts.api'
import { BankPortalFormDialog } from './bank-portal-form-dialog'

const createMutate = vi.fn()
const updateMutate = vi.fn()

vi.mock('../hooks/use-create-bank-portal', () => ({
  useCreateBankPortal: () => ({ mutate: createMutate, isPending: false }),
}))
vi.mock('../hooks/use-update-bank-portal', () => ({
  useUpdateBankPortal: () => ({ mutate: updateMutate, isPending: false }),
}))

const noop = () => {}

describe('<BankPortalFormDialog>', () => {
  beforeEach(() => {
    createMutate.mockReset()
    updateMutate.mockReset()
  })
  afterEach(() => vi.restoreAllMocks())

  it('creates a portal with name + url', async () => {
    render(<BankPortalFormDialog open onOpenChange={noop} portal={null} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Name'), 'Frost Bank')
    await user.type(screen.getByLabelText(/portal url/i), 'https://frostbank.com')
    await user.click(screen.getByRole('button', { name: /add portal/i }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const [body] = createMutate.mock.calls[0]
    expect(body).toEqual({ name: 'Frost Bank', portalUrl: 'https://frostbank.com' })
  })

  it('blocks submit and shows error when name is empty', async () => {
    render(<BankPortalFormDialog open onOpenChange={noop} portal={null} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /add portal/i }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('prefills and updates in edit mode', async () => {
    const portal = {
      id: 'p-1',
      name: 'Chase',
      portal_url: 'https://chase.com',
      created_at: '',
      updated_at: '',
    } as BankPortal

    render(<BankPortalFormDialog open onOpenChange={noop} portal={portal} />)
    const name = screen.getByLabelText('Name')
    expect(name).toHaveValue('Chase')

    const user = userEvent.setup()
    await user.clear(name)
    await user.type(name, 'Chase Bank')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    const [vars] = updateMutate.mock.calls[0]
    expect(vars.portalId).toBe('p-1')
    expect(vars.body.name).toBe('Chase Bank')
  })
})
