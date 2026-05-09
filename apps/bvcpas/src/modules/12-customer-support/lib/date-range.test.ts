// Tests del helper date-range (v0.5.0, Bloque A).
//
// Reglas de cálculo (D-bvcpas-031):
// - from = (currentYear - 1)-01-01.
// - to   = último día del mes anterior a "now".
// - dashboardMonth = mes anterior a "now" (1..12) + label en inglés.

import { describe, expect, it } from 'vitest'

import { computeRange, dashboardMonth, MONTH_LABELS } from './date-range'

describe('computeRange', () => {
  it('returns from = (year-1)-01-01 and to = last day of previous month', () => {
    const range = computeRange(new Date('2026-05-09T12:00:00Z'))
    expect(range.from).toBe('2025-01-01')
    expect(range.to).toBe('2026-04-30')
  })

  it('handles January correctly (previous month is December of previous year)', () => {
    const range = computeRange(new Date('2026-01-15T12:00:00Z'))
    expect(range.from).toBe('2025-01-01')
    expect(range.to).toBe('2025-12-31')
  })

  it('handles end-of-month edge cases', () => {
    // 2026-03-01 → mes anterior febrero, último día = 28 (no leap).
    const range = computeRange(new Date('2026-03-01T00:00:00Z'))
    expect(range.from).toBe('2025-01-01')
    expect(range.to).toBe('2026-02-28')
  })

  it('handles February in a leap year', () => {
    // 2024 fue bisiesto. 2024-03-15 → to = 2024-02-29.
    const range = computeRange(new Date('2024-03-15T12:00:00Z'))
    expect(range.from).toBe('2023-01-01')
    expect(range.to).toBe('2024-02-29')
  })
})

describe('dashboardMonth', () => {
  it('returns previous month with English label', () => {
    expect(dashboardMonth(new Date('2026-05-09T12:00:00Z'))).toEqual({
      month: 4,
      year: 2026,
      label: 'April',
    })
  })

  it('wraps to December of previous year when called in January', () => {
    expect(dashboardMonth(new Date('2026-01-15T12:00:00Z'))).toEqual({
      month: 12,
      year: 2025,
      label: 'December',
    })
  })
})

describe('MONTH_LABELS', () => {
  it('has 12 entries Jan..Dec in English', () => {
    expect(MONTH_LABELS).toHaveLength(12)
    expect(MONTH_LABELS[0]).toBe('January')
    expect(MONTH_LABELS[11]).toBe('December')
  })
})
