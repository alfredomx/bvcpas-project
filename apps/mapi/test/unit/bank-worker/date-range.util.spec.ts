import { resolveDateRange, resolveToday } from '../../../src/modules/22-bank-worker/date-range.util'

/**
 * Tests Tipo A para `resolveDateRange` (v0.21.0). Función pura: `now` inyectado
 * para que los presets sean deterministas. Zona base de las aserciones:
 * America/Chicago (CDT = UTC-5 en marzo 2026, tras el cambio de horario).
 *
 * `now = 2026-03-15T18:00:00Z` → 13:00 CDT del 2026-03-15 → "hoy" = 03-15-2026.
 */
const NOW = new Date('2026-03-15T18:00:00Z')

describe('resolveDateRange — presets (America/Chicago)', () => {
  const tz = 'America/Chicago'

  it('today → from=to=hoy', () => {
    expect(resolveDateRange({ range: 'today', timezone: tz }, NOW)).toEqual({
      from: '03-15-2026',
      to: '03-15-2026',
    })
  })

  it('yesterday → from=to=ayer', () => {
    expect(resolveDateRange({ range: 'yesterday', timezone: tz }, NOW)).toEqual({
      from: '03-14-2026',
      to: '03-14-2026',
    })
  })

  it('last_7_days → hoy y 6 días atrás (7 inclusive)', () => {
    expect(resolveDateRange({ range: 'last_7_days', timezone: tz }, NOW)).toEqual({
      from: '03-09-2026',
      to: '03-15-2026',
    })
  })

  it('this_week → lunes de esta semana → hoy (como bankify `week`)', () => {
    // NOW = domingo 2026-03-15 → lunes de esta semana = 03-09 .. hoy 03-15.
    expect(resolveDateRange({ range: 'this_week', timezone: tz }, NOW)).toEqual({
      from: '03-09-2026',
      to: '03-15-2026',
    })
  })

  it('last_week → semana calendario anterior, lunes→domingo (como bankify `lastweek`)', () => {
    // NOW = domingo 2026-03-15 → semana pasada = 03-02 (lun) .. 03-08 (dom).
    expect(resolveDateRange({ range: 'last_week', timezone: tz }, NOW)).toEqual({
      from: '03-02-2026',
      to: '03-08-2026',
    })
  })

  it('last_30_days → hoy y 29 días atrás', () => {
    expect(resolveDateRange({ range: 'last_30_days', timezone: tz }, NOW)).toEqual({
      from: '02-14-2026',
      to: '03-15-2026',
    })
  })

  it('this_month → primero del mes a hoy', () => {
    expect(resolveDateRange({ range: 'this_month', timezone: tz }, NOW)).toEqual({
      from: '03-01-2026',
      to: '03-15-2026',
    })
  })

  it('last_month → mes anterior completo', () => {
    expect(resolveDateRange({ range: 'last_month', timezone: tz }, NOW)).toEqual({
      from: '02-01-2026',
      to: '02-28-2026',
    })
  })

  it('this_year → 1 de enero a hoy', () => {
    expect(resolveDateRange({ range: 'this_year', timezone: tz }, NOW)).toEqual({
      from: '01-01-2026',
      to: '03-15-2026',
    })
  })

  it('last_year → año anterior completo', () => {
    expect(resolveDateRange({ range: 'last_year', timezone: tz }, NOW)).toEqual({
      from: '01-01-2025',
      to: '12-31-2025',
    })
  })
})

describe('resolveDateRange — explícito y zona horaria', () => {
  it('from+to explícitos pasan tal cual (ignoran zona)', () => {
    expect(
      resolveDateRange({ from: '01-05-2024', to: '06-30-2024', timezone: 'America/Chicago' }, NOW),
    ).toEqual({ from: '01-05-2024', to: '06-30-2024' })
  })

  it('timezone null usa el default (America/Chicago)', () => {
    // 04:00Z → 23:00 CDT del día anterior en Chicago → hoy = 03-14.
    const lateNight = new Date('2026-03-15T04:00:00Z')
    expect(resolveDateRange({ range: 'today', timezone: null }, lateNight)).toEqual({
      from: '03-14-2026',
      to: '03-14-2026',
    })
  })

  it('respeta la zona pasada (UTC vs Chicago dan días distintos)', () => {
    const lateNight = new Date('2026-03-15T04:00:00Z')
    expect(resolveDateRange({ range: 'today', timezone: 'UTC' }, lateNight)).toEqual({
      from: '03-15-2026',
      to: '03-15-2026',
    })
  })

  it('sin range ni from/to lanza error (defensa; el DTO ya lo previene)', () => {
    expect(() => resolveDateRange({}, NOW)).toThrow()
  })
})

describe('resolveToday — ancla para rangos libres', () => {
  it('devuelve hoy en MM-DD-YYYY + la zona usada', () => {
    expect(resolveToday('America/Chicago', NOW)).toEqual({
      today: '03-15-2026',
      timezone: 'America/Chicago',
    })
  })

  it('zona null usa el default (America/Chicago)', () => {
    const lateNight = new Date('2026-03-15T04:00:00Z') // 23:00 CDT del 14 en Chicago
    expect(resolveToday(null, lateNight)).toEqual({
      today: '03-14-2026',
      timezone: 'America/Chicago',
    })
  })
})
