import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { BankAccount } from '../api/bank-accounts.api'
import { BankAccountFormDialog } from './bank-account-form-dialog'

const createMutate = vi.fn()
const updateMutate = vi.fn()

vi.mock('../hooks/use-create-bank-account', () => ({
  useCreateBankAccount: () => ({ mutate: createMutate, isPending: false }),
}))
vi.mock('../hooks/use-update-bank-account', () => ({
  useUpdateBankAccount: () => ({ mutate: updateMutate, isPending: false }),
}))

const noop = () => {}

describe('<BankAccountFormDialog>', () => {
  beforeEach(() => {
    createMutate.mockReset()
    updateMutate.mockReset()
  })
  afterEach(() => vi.restoreAllMocks())

  it('creates an account with mask + default type', async () => {
    render(<BankAccountFormDialog open onOpenChange={noop} credentialId="cred-1" account={null} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Mask (last 4)'), '4242')
    await user.click(screen.getByRole('button', { name: /add account/i }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const [vars] = createMutate.mock.calls[0]
    expect(vars.credentialId).toBe('cred-1')
    expect(vars.body.accountMask).toBe('4242')
    expect(vars.body.accountType).toBe('checking')
  })

  it('opens clean again after a create (no stale values)', async () => {
    const { rerender } = render(
      <BankAccountFormDialog open onOpenChange={noop} credentialId="cred-1" account={null} />,
    )
    await userEvent.setup().type(screen.getByLabelText('Mask (last 4)'), '1234')
    expect(screen.getByLabelText('Mask (last 4)')).toHaveValue('1234')

    rerender(
      <BankAccountFormDialog
        open={false}
        onOpenChange={noop}
        credentialId="cred-1"
        account={null}
      />,
    )
    rerender(
      <BankAccountFormDialog open onOpenChange={noop} credentialId="cred-1" account={null} />,
    )

    expect(screen.getByLabelText('Mask (last 4)')).toHaveValue('')
  })

  it('prefills the mask in edit mode', () => {
    const account = {
      id: 'a-1',
      client_bank_account_id: 'cred-1',
      account_mask: '9999',
      account_type: 'savings',
      label: 'Savings',
      status: 'active',
      notes: null,
      created_at: '',
      updated_at: '',
    } as BankAccount

    render(
      <BankAccountFormDialog open onOpenChange={noop} credentialId="cred-1" account={account} />,
    )
    expect(screen.getByLabelText('Mask (last 4)')).toHaveValue('9999')
  })
})
