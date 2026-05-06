// Tests retroactivos de SessionProvider (v0.2.1, Bloque 4).
//
// Estrategia: render del provider con un Probe hijo que expone los
// valores del context vía DOM (textContent / data-attr) + botones que
// disparan login/logout. Mockeamos auth.api con vi.mock.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SessionProvider, useSession } from './use-session'
import type { User } from '../types'

const fakeUser: User = {
  id: 'u-1',
  email: 'a@b.com',
  fullName: 'Test User',
  role: 'admin',
  status: 'active',
}

// Mock del módulo api/auth.api — controlamos qué resuelven login/me/logout.
const loginMock = vi.fn()
const meMock = vi.fn()
const logoutMock = vi.fn()

vi.mock('../api/auth.api', () => ({
  login: (...args: unknown[]) => loginMock(...args),
  me: (...args: unknown[]) => meMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
}))

function Probe() {
  const { user, accessToken, isLoading, login, logout } = useSession()
  return (
    <div>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="token">{accessToken ?? 'null'}</span>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <button onClick={() => login('a@b.com', 'pw')}>do-login</button>
      <button onClick={() => logout()}>do-logout</button>
    </div>
  )
}

describe('SessionProvider', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    loginMock.mockReset()
    meMock.mockReset()
    logoutMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hydrates user from sessionStorage on mount', async () => {
    window.sessionStorage.setItem('bvcpas.accessToken', 'cached-token')
    window.sessionStorage.setItem('bvcpas.user', JSON.stringify(fakeUser))
    // me nunca resuelve para no sobreescribir antes de que assertemos cache.
    meMock.mockReturnValue(new Promise(() => {}))

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )

    // Cache aplicado en el primer effect, antes de que /me resuelva.
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('a@b.com')
      expect(screen.getByTestId('token').textContent).toBe('cached-token')
    })
  })

  it('calls GET /v1/auth/me on mount and updates user from response', async () => {
    window.sessionStorage.setItem('bvcpas.accessToken', 'cached-token')
    const freshUser: User = { ...fakeUser, fullName: 'Fresh Name' }
    meMock.mockResolvedValue(freshUser)

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    // sessionStorage refleja al user fresco.
    expect(JSON.parse(window.sessionStorage.getItem('bvcpas.user') ?? '{}')).toMatchObject({
      fullName: 'Fresh Name',
    })
  })

  it('login() updates context user and persists to storage', async () => {
    // Sin sesión inicial.
    meMock.mockResolvedValue(fakeUser)
    loginMock.mockResolvedValue({ accessToken: 'new-token', user: fakeUser })

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    // Espera hidratación inicial (sin token → isLoading false rápido).
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    const user = userEvent.setup()
    await user.click(screen.getByText('do-login'))

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('a@b.com')
      expect(screen.getByTestId('token').textContent).toBe('new-token')
    })
    expect(window.sessionStorage.getItem('bvcpas.accessToken')).toBe('new-token')
    expect(JSON.parse(window.sessionStorage.getItem('bvcpas.user') ?? '{}')).toMatchObject({
      email: 'a@b.com',
    })
  })

  it('logout() clears context user and storage', async () => {
    window.sessionStorage.setItem('bvcpas.accessToken', 'cached-token')
    window.sessionStorage.setItem('bvcpas.user', JSON.stringify(fakeUser))
    meMock.mockResolvedValue(fakeUser)
    logoutMock.mockResolvedValue(undefined)

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@b.com'))

    const user = userEvent.setup()
    await user.click(screen.getByText('do-logout'))

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null')
      expect(screen.getByTestId('token').textContent).toBe('null')
    })
    expect(window.sessionStorage.getItem('bvcpas.accessToken')).toBeNull()
    expect(window.sessionStorage.getItem('bvcpas.user')).toBeNull()
  })
})
