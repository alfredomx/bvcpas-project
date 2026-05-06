// Tests TDD-first de <Topbar> (v0.3.0, Bloque 5).
//
// Siempre [nombre + avatar]. Sin KPIs (decisión confirmada).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Topbar } from './topbar'

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
    logout: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), message: vi.fn() },
}))

describe('<Topbar>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the user fullName', () => {
    render(<Topbar />)
    expect(screen.getByText('Alfredo Guerrero')).toBeInTheDocument()
  })

  it('renders the avatar trigger with the user initial', () => {
    render(<Topbar />)
    expect(screen.getByRole('button', { name: /open user menu/i })).toHaveTextContent('A')
  })
})
