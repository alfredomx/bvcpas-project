// Tests retroactivos del LoginForm (v0.2.1, Bloque 5).
//
// 3 tests (set recortado):
//   - submit con credenciales válidas (mock 200) → router.replace('/dashboard')
//   - submit con 401 INVALID_CREDENTIALS → toast con mensaje correcto
//   - email inválido → bloquea submit, NO llama API
//
// El form depende de useSession() (hook con Context), así que envolvemos
// el render en <SessionProvider>. Mockeamos auth.api para controlar las
// respuestas + next/navigation para interceptar router.replace.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LoginForm } from './login-form'
import { SessionProvider } from '../hooks/use-session'
import type { User } from '../types'

const fakeUser: User = {
  id: 'u-1',
  email: 'a@b.com',
  fullName: 'Test User',
  role: 'admin',
  status: 'active',
}

// Mock de auth.api.
const loginMock = vi.fn()
const meMock = vi.fn()
const logoutMock = vi.fn()

vi.mock('../api/auth.api', () => ({
  login: (...args: unknown[]) => loginMock(...args),
  me: (...args: unknown[]) => meMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
}))

// Mock de next/navigation.
const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: replaceMock,
    prefetch: vi.fn(),
  }),
}))

// Mock de sonner para no renderizar el toast real (ya está testeado por
// la lib upstream). Solo capturamos la llamada para asertar el texto.
const toastErrorMock = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (msg: string) => toastErrorMock(msg),
    message: vi.fn(),
  },
}))

function renderForm() {
  // Sin sesión inicial — el form se renderiza (no splash).
  meMock.mockResolvedValue(fakeUser) // por si llega a llamarse, no rompa
  return render(
    <SessionProvider>
      <LoginForm />
    </SessionProvider>,
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    loginMock.mockReset()
    meMock.mockReset()
    logoutMock.mockReset()
    replaceMock.mockReset()
    toastErrorMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits valid credentials and redirects to /dashboard', async () => {
    loginMock.mockResolvedValue({ accessToken: 'tok', user: fakeUser })

    renderForm()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/work email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'pw123')
    await user.click(screen.getByRole('button', { name: /^sign in/i }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw123' })
      expect(replaceMock).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows mapped error message on 401 INVALID_CREDENTIALS', async () => {
    // ApiError importado dentro del mock — el form lo recibe como rejected.
    const { ApiError } = await import('@/lib/http')
    loginMock.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'mal'))

    renderForm()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/work email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /^sign in/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Invalid email or password.')
    })
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('does not call API when email is invalid', async () => {
    renderForm()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/work email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'pw123')
    await user.click(screen.getByRole('button', { name: /^sign in/i }))

    // Zod bloquea submit. Damos tiempo al microtask y verificamos que
    // login NO se llamó.
    await new Promise((r) => setTimeout(r, 50))
    expect(loginMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
