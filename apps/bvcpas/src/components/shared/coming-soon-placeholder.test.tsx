// Tests TDD-first de <ComingSoonPlaceholder> (v0.3.0, Bloque 8).
//
// Componente compartido. Lo usan las 8 tabs de cliente en v0.3.0
// + cualquier futura pantalla "no implementada".

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ComingSoonPlaceholder } from './coming-soon-placeholder'

describe('<ComingSoonPlaceholder>', () => {
  it('renders the tab name in the message', () => {
    render(<ComingSoonPlaceholder tab="Reconciliations" />)
    expect(screen.getByText(/reconciliations/i)).toBeInTheDocument()
  })

  it('renders the "Coming soon" headline', () => {
    render(<ComingSoonPlaceholder tab="W-9" />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
