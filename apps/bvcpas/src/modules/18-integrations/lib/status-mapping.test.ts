import { describe, expect, it } from 'vitest'

import { deriveInitials, STATUS_LABEL } from './status-mapping'

describe('STATUS_LABEL', () => {
  it('maps healthy → Connected', () => {
    expect(STATUS_LABEL.healthy).toBe('Connected')
  })
  it('maps needs_reauth → Re-auth needed', () => {
    expect(STATUS_LABEL.needs_reauth).toBe('Re-auth needed')
  })
  it('maps paused → Paused', () => {
    expect(STATUS_LABEL.paused).toBe('Paused')
  })
})

describe('deriveInitials', () => {
  it('takes first letter of first two words when multi-word', () => {
    expect(deriveInitials('Square POS')).toBe('SP')
  })
  it('takes first two chars when single word', () => {
    expect(deriveInitials('Clover')).toBe('CL')
  })
  it('always uppercase', () => {
    expect(deriveInitials('clover')).toBe('CL')
  })
})
