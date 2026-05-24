// Smoke test del <ClientHomeScreen> (v0.9.0, visual only).

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ClientHomeScreen } from './client-home-screen'

describe('<ClientHomeScreen>', () => {
  it('renders the legal name in the header', () => {
    render(<ClientHomeScreen clientId="c-1" legalName="Acme Corp" />)
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument()
  })

  it('renders the greeting from mock data', () => {
    render(<ClientHomeScreen clientId="c-1" legalName="Acme Corp" />)
    expect(screen.getByText(/Good evening, Alfredo/)).toBeInTheDocument()
  })

  it('renders the close banner CTA', () => {
    render(<ClientHomeScreen clientId="c-1" legalName="Acme Corp" />)
    expect(screen.getByText(/Open uncat report/)).toBeInTheDocument()
  })

  it('renders the bookkeeper name', () => {
    render(<ClientHomeScreen clientId="c-1" legalName="Acme Corp" />)
    expect(screen.getByText(/Maria Rivera/)).toBeInTheDocument()
  })
})
