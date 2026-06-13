import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CredentialSecretField } from './credential-secret-field'

const writeText = vi.fn().mockResolvedValue(undefined)

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('<CredentialSecretField>', () => {
  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a non-secret value in plain text', () => {
    render(<CredentialSecretField label="Username" value="jdoe" />)
    expect(screen.getByText('jdoe')).toBeInTheDocument()
  })

  it('masks a secret value and reveals it on toggle', async () => {
    render(<CredentialSecretField label="Password" value="s3cret" secret />)
    expect(screen.getByText('••••••••')).toBeInTheDocument()
    expect(screen.queryByText('s3cret')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: /reveal password/i }))
    expect(screen.getByText('s3cret')).toBeInTheDocument()
  })

  it('copies the value to the clipboard', async () => {
    // fireEvent (no userEvent): userEvent.setup() instala su propio stub
    // de navigator.clipboard y taparía el spy.
    render(<CredentialSecretField label="Username" value="jdoe" />)
    fireEvent.click(screen.getByRole('button', { name: /copy username/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('jdoe'))
  })

  it('renders a dash and no reveal action when empty', () => {
    render(<CredentialSecretField label="Security Q&A" value={null} secret />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
  })
})
