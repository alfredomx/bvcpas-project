// Tests retroactivos del AuthenticatedLayout (v0.2.1, Bloque 6).
//
// 2 tests:
//   - sin sesión → redirect a /
//   - listener auth:unauthorized → limpia sesión + redirect

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import AuthenticatedLayout from './layout'
import { SessionProvider } from '@/modules/10-core-auth/hooks/use-session'
import type { User } from '@/modules/10-core-auth/types'

const fakeUser: User = {
  id: 'u-1',
  email: 'a@b.com',
  fullName: 'Test User',
  role: 'admin',
  status: 'active',
}

const meMock = vi.fn()
const loginMock = vi.fn()
const logoutMock = vi.fn()

vi.mock('@/modules/10-core-auth/api/auth.api', () => ({
  login: (...args: unknown[]) => loginMock(...args),
  me: (...args: unknown[]) => meMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
}))

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: replaceMock,
    prefetch: vi.fn(),
  }),
}))

const toastErrorMock = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (msg: string) => toastErrorMock(msg),
    message: vi.fn(),
  },
}))

describe('AuthenticatedLayout', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    meMock.mockReset()
    replaceMock.mockReset()
    toastErrorMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to / when user is null after hydration', async () => {
    // Sin token → SessionProvider termina con user=null + isLoading=false.
    // El layout debe llamar router.replace('/').
    render(
      <SessionProvider>
        <AuthenticatedLayout>
          <div>protected</div>
        </AuthenticatedLayout>
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
  })

  it('clears session and redirects on auth:unauthorized event', async () => {
    // Sesión activa al montar.
    window.sessionStorage.setItem('bvcpas.accessToken', 'tok')
    window.sessionStorage.setItem('bvcpas.user', JSON.stringify(fakeUser))
    meMock.mockResolvedValue(fakeUser)

    render(
      <SessionProvider>
        <AuthenticatedLayout>
          <div>protected</div>
        </AuthenticatedLayout>
      </SessionProvider>,
    )

    // Esperar a que el provider hidrate y el layout monte el listener.
    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1)
    })

    // Disparar el evento como lo hace lib/http.ts ante 401.
    window.dispatchEvent(new Event('auth:unauthorized'))

    await waitFor(() => {
      expect(window.sessionStorage.getItem('bvcpas.accessToken')).toBeNull()
      expect(window.sessionStorage.getItem('bvcpas.user')).toBeNull()
      expect(toastErrorMock).toHaveBeenCalledWith('Your session expired. Sign in again.')
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
  })
})
