// Tests TDD-first de <SidebarCollapsed> (v0.3.0, Bloque 4c).
//
// Versión angosta de la sidebar (~48px) con SOLO el botón de expandir.
// Sin iconos de navegación adicionales (decisión del operador).

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SidebarCollapsed } from './sidebar-collapsed'

describe('<SidebarCollapsed>', () => {
  it('renders an expand button with accessible label', () => {
    render(<SidebarCollapsed onExpand={vi.fn()} />)
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()
  })

  it('calls onExpand when the button is clicked', async () => {
    const onExpand = vi.fn()
    render(<SidebarCollapsed onExpand={onExpand} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /expand sidebar/i }))

    expect(onExpand).toHaveBeenCalledTimes(1)
  })
})
