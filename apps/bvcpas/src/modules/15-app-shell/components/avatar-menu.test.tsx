// Tests TDD-first de <AvatarMenu> (v0.3.0, Bloque 5).
//
// Dropdown estilo Crunchyroll. v0.3.0:
//   - "Change profile" → toast placeholder.
//   - "Logout" → llama useSession().logout().
// avatar.url no existe en backend; mostramos inicial del fullName.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AvatarMenu } from './avatar-menu'

const logoutMock = vi.fn()

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
    logout: logoutMock,
  }),
}))

const toastMessageMock = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    message: (msg: string) => toastMessageMock(msg),
  },
}))

describe('<AvatarMenu>', () => {
  beforeEach(() => {
    logoutMock.mockReset()
    toastMessageMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the initial of the user fullName inside the trigger', () => {
    render(<AvatarMenu />)
    expect(screen.getByRole('button', { name: /open user menu/i })).toHaveTextContent('A')
  })

  it('opens the dropdown with Change profile + Logout when clicked', async () => {
    render(<AvatarMenu />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open user menu/i }))

    expect(screen.getByRole('menuitem', { name: /change profile/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument()
  })

  it('Change profile shows a coming-soon toast', async () => {
    render(<AvatarMenu />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open user menu/i }))
    await user.click(screen.getByRole('menuitem', { name: /change profile/i }))

    expect(toastMessageMock).toHaveBeenCalledTimes(1)
    expect(toastMessageMock.mock.calls[0][0]).toMatch(/coming soon/i)
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it('Logout calls useSession().logout()', async () => {
    render(<AvatarMenu />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open user menu/i }))
    await user.click(screen.getByRole('menuitem', { name: /logout/i }))

    expect(logoutMock).toHaveBeenCalledTimes(1)
  })
})
