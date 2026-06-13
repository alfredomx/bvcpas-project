import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { BankLogin } from '../api/bank-accounts.api'
import { CredentialCard } from './credential-card'

vi.mock('../hooks/use-bank-login-accounts', () => ({
  useBankLoginAccounts: () => ({
    data: {
      data: [
        {
          id: 'a-1',
          client_bank_account_id: 'cred-1',
          account_mask: '4242',
          account_type: 'checking',
          label: 'Primary',
          status: 'active',
          notes: null,
          created_at: '',
          updated_at: '',
        },
      ],
    },
    isLoading: false,
  }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const login = {
  id: 'cred-1',
  client: { id: 'c-1', legal_name: 'Acme LLC' },
  portal: { id: 'p-1', name: 'Chase', portal_url: 'https://chase.com' },
  username: 'jdoe',
  password: 's3cret',
  security_qa: null,
  status: 'active',
  notes: 'note here',
  created_at: '',
  updated_at: '',
} as BankLogin

const noop = () => {}

describe('<CredentialCard>', () => {
  it('renders portal + username and masks the password', () => {
    render(<CredentialCard login={login} onOpenAccounts={noop} onEdit={noop} onDelete={noop} />)
    expect(screen.getByText('Chase')).toBeInTheDocument()
    expect(screen.getByText('jdoe')).toBeInTheDocument()
    expect(screen.queryByText('s3cret')).not.toBeInTheDocument()
  })

  it('shows the client name only when showClient is set', () => {
    const { rerender } = render(
      <CredentialCard login={login} onOpenAccounts={noop} onEdit={noop} onDelete={noop} />,
    )
    expect(screen.queryByText('Acme LLC')).not.toBeInTheDocument()

    rerender(
      <CredentialCard
        login={login}
        showClient
        onOpenAccounts={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    )
    expect(screen.getByText('Acme LLC')).toBeInTheDocument()
  })

  it('shows the account count in the accounts trigger', () => {
    render(<CredentialCard login={login} onOpenAccounts={noop} onEdit={noop} onDelete={noop} />)
    expect(screen.getByText('1 account')).toBeInTheDocument()
  })
})
