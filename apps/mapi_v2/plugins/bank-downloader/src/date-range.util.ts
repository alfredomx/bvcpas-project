/**
 * Resolución de rangos de fecha para la descarga bancaria.
 *
 * El operador pide un rango con una palabra (`today`, `last_7_days`, ...) y mapi
 * lo resuelve a `from`/`to` concretos en `MM-DD-YYYY` (formato del adapter). El
 * cálculo usa la zona del cliente (`clients.timezone`); si no tiene, `America/Chicago`.
 *
 * Función PURA y determinista: recibe `now` opcional para tests reproducibles.
 */

/** Presets de rango aceptados (en inglés). */
export const DATE_RANGE_PRESETS = [
  'today',
  'yesterday',
  'last_7_days',
  'this_week',
  'last_week',
  'last_30_days',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
] as const

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]

/** Zona horaria por defecto cuando el cliente no tiene una configurada. */
export const DEFAULT_BANK_TIMEZONE = 'America/Chicago'

/** Rango resuelto. Ambas fechas en `MM-DD-YYYY`. */
export interface ResolvedDateRange {
  from: string
  to: string
}

export interface ResolveDateRangeInput {
  /** Preset (`today`, `last_7_days`, ...). Excluyente con `from`/`to`. */
  range?: DateRangePreset
  /** Fecha inicial explícita `MM-DD-YYYY` (requiere `to`). */
  from?: string
  /** Fecha final explícita `MM-DD-YYYY` (requiere `from`). */
  to?: string
  /** Zona horaria IANA del cliente. `null`/`undefined` → `DEFAULT_BANK_TIMEZONE`. */
  timezone?: string | null
}

/** Fecha civil (sin hora ni zona). `m` es 1-12. */
interface CivilDate {
  y: number
  m: number
  d: number
}

/** Fecha civil "hoy" en la zona dada, derivada del instante `now`. */
function civilToday(now: Date, timezone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** Suma `days` (puede ser negativo) a una fecha civil, en aritmética UTC. */
function addDays(c: CivilDate, days: number): CivilDate {
  const dt = new Date(Date.UTC(c.y, c.m - 1, c.d) + days * 86_400_000)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

/** Último día del mes `m` (1-12) del año `y`. */
function lastDayOfMonth(y: number, m: number): CivilDate {
  const dt = new Date(Date.UTC(y, m, 0))
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

/** Día de la semana (0=domingo .. 6=sábado) de una fecha civil. */
function dayOfWeek(c: CivilDate): number {
  return new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay()
}

/** Fecha civil → `MM-DD-YYYY`. */
function fmt(c: CivilDate): string {
  const mm = String(c.m).padStart(2, '0')
  const dd = String(c.d).padStart(2, '0')
  return `${mm}-${dd}-${c.y}`
}

function resolvePreset(preset: DateRangePreset, today: CivilDate): ResolvedDateRange {
  switch (preset) {
    case 'today':
      return { from: fmt(today), to: fmt(today) }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { from: fmt(y), to: fmt(y) }
    }
    case 'last_7_days':
      return { from: fmt(addDays(today, -6)), to: fmt(today) }
    case 'this_week': {
      const dow = dayOfWeek(today)
      const daysToMonday = dow === 0 ? -6 : 1 - dow
      return { from: fmt(addDays(today, daysToMonday)), to: fmt(today) }
    }
    case 'last_week': {
      const dow = dayOfWeek(today)
      const daysToLastMonday = dow === 0 ? -13 : -6 - dow
      const lastMonday = addDays(today, daysToLastMonday)
      return { from: fmt(lastMonday), to: fmt(addDays(lastMonday, 6)) }
    }
    case 'last_30_days':
      return { from: fmt(addDays(today, -29)), to: fmt(today) }
    case 'this_month':
      return { from: fmt({ y: today.y, m: today.m, d: 1 }), to: fmt(today) }
    case 'last_month': {
      const lastDayPrev = addDays({ y: today.y, m: today.m, d: 1 }, -1)
      return { from: fmt({ y: lastDayPrev.y, m: lastDayPrev.m, d: 1 }), to: fmt(lastDayPrev) }
    }
    case 'this_year':
      return { from: fmt({ y: today.y, m: 1, d: 1 }), to: fmt(today) }
    case 'last_year':
      return {
        from: fmt({ y: today.y - 1, m: 1, d: 1 }),
        to: fmt(lastDayOfMonth(today.y - 1, 12)),
      }
  }
}

/** Resuelve el input del operador a un rango concreto `MM-DD-YYYY`. */
export function resolveDateRange(
  input: ResolveDateRangeInput,
  now: Date = new Date(),
): ResolvedDateRange {
  if (input.from !== undefined && input.to !== undefined) {
    return { from: input.from, to: input.to }
  }
  if (input.range === undefined) {
    throw new Error('resolveDateRange: se requiere `range` o `from`+`to`')
  }
  const tz = input.timezone ?? DEFAULT_BANK_TIMEZONE
  return resolvePreset(input.range, civilToday(now, tz))
}

/** "Hoy" en `MM-DD-YYYY` para la zona del cliente (ancla para traducir frases libres). */
export function resolveToday(
  timezone?: string | null,
  now: Date = new Date(),
): { today: string; timezone: string } {
  const tz = timezone ?? DEFAULT_BANK_TIMEZONE
  return { today: fmt(civilToday(now, tz)), timezone: tz }
}
