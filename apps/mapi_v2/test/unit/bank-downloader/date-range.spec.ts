import {
  resolveDateRange,
  resolveToday,
  DEFAULT_BANK_TIMEZONE,
} from '@plugins/bank-downloader/src/date-range.util'

// Instante fijo: lunes 16-mar-2026 13:00Z → 08:00 en America/Chicago (CDT), sigue 03-16.
const NOW = new Date('2026-03-16T13:00:00Z')
const TZ = 'America/Chicago'

describe('resolveDateRange', () => {
  it('pasa `from`/`to` explícitos sin tocarlos', () => {
    expect(resolveDateRange({ from: '01-02-2025', to: '02-03-2025' }, NOW)).toEqual({
      from: '01-02-2025',
      to: '02-03-2025',
    })
  })

  it('lanza si no hay `range` ni `from`+`to`', () => {
    expect(() => resolveDateRange({}, NOW)).toThrow(/range/)
  })

  it.each([
    ['today', { from: '03-16-2026', to: '03-16-2026' }],
    ['yesterday', { from: '03-15-2026', to: '03-15-2026' }],
    ['last_7_days', { from: '03-10-2026', to: '03-16-2026' }],
    ['this_week', { from: '03-16-2026', to: '03-16-2026' }],
    ['last_week', { from: '03-09-2026', to: '03-15-2026' }],
    ['last_30_days', { from: '02-15-2026', to: '03-16-2026' }],
    ['this_month', { from: '03-01-2026', to: '03-16-2026' }],
    ['last_month', { from: '02-01-2026', to: '02-28-2026' }],
    ['this_year', { from: '01-01-2026', to: '03-16-2026' }],
    ['last_year', { from: '01-01-2025', to: '12-31-2025' }],
  ] as const)('resuelve el preset %s', (range, expected) => {
    expect(resolveDateRange({ range, timezone: TZ }, NOW)).toEqual(expected)
  })
})

describe('resolveToday', () => {
  it('devuelve hoy en la zona del cliente', () => {
    expect(resolveToday(TZ, NOW)).toEqual({ today: '03-16-2026', timezone: TZ })
  })

  it('cae a la zona por defecto si no hay timezone', () => {
    expect(resolveToday(null, NOW)).toEqual({
      today: '03-16-2026',
      timezone: DEFAULT_BANK_TIMEZONE,
    })
  })
})
