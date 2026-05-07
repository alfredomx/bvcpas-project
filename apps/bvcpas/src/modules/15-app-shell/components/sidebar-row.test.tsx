// Tests TDD-first de <SidebarRow> (v0.3.0, Bloque 4a, simplificado).
//
// En v0.3.0 la fila SOLO muestra el nombre del cliente. El resto de
// metadatos visuales (heat bar, monto, status pill, sparkline, VIP)
// se difiere a versiones futuras cuando el operador defina las reglas.

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SidebarRow } from './sidebar-row'

describe('<SidebarRow>', () => {
  it('renders the client legal_name', () => {
    render(<SidebarRow clientId="c-1" legalName="Elite Fence & Welding, LLC" onSelect={vi.fn()} />)
    expect(screen.getByText('Elite Fence & Welding, LLC')).toBeInTheDocument()
  })

  it('calls onSelect with clientId when clicked', async () => {
    const onSelect = vi.fn()
    render(<SidebarRow clientId="c-1" legalName="Acme LLC" onSelect={onSelect} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /acme llc/i }))

    expect(onSelect).toHaveBeenCalledWith('c-1')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('marks the row as active with aria-current="page" when active=true', () => {
    render(<SidebarRow clientId="c-1" legalName="Acme LLC" active onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /acme llc/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('does not mark as active when active=false (default)', () => {
    render(<SidebarRow clientId="c-1" legalName="Acme LLC" onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /acme llc/i })).not.toHaveAttribute('aria-current')
  })
})
