/**
 * Resolución de rangos de fecha para la descarga bancaria (v0.21.0).
 *
 * El operador pide un rango con una palabra (`today`, `last_7_days`, ...) — en
 * inglés, decisión D-mapi-BW-013 — y mapi lo resuelve a `from`/`to` concretos en
 * formato `MM-DD-YYYY` (el formato público del `IBankAdapter`). El cálculo usa la
 * zona horaria del cliente (`clients.timezone`); si el cliente no tiene zona, se
 * usa `America/Chicago` (BV CPAs opera en Texas).
 *
 * Función PURA y determinista: recibe `now` opcional para tests reproducibles.
 * Sin dependencias externas — fechas civiles vía `Intl.DateTimeFormat` + aritmética
 * en UTC (evita corrimientos por DST).
 */

/** Presets de rango aceptados (en inglés, D-mapi-BW-013). */
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
  const dt = new Date(Date.UTC(y, m, 0)) // día 0 del mes siguiente = último del actual
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
      // Esta semana: lunes → hoy (como bankify `week`). D-mapi-BW-016.
      const dow = dayOfWeek(today)
      const daysToMonday = dow === 0 ? -6 : 1 - dow
      return { from: fmt(addDays(today, daysToMonday)), to: fmt(today) }
    }
    case 'last_week': {
      // Semana calendario anterior, lunes→domingo (como bankify `lastweek`). D-mapi-BW-016.
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

/**
 * Resuelve el input del operador a un rango concreto `MM-DD-YYYY`.
 *
 * - Si vienen `from`+`to` explícitos, se devuelven tal cual (ya validados como
 *   `MM-DD-YYYY` por el DTO).
 * - Si viene un `range` preset, se calcula contra "hoy" en la zona del cliente.
 *
 * El DTO garantiza que llega exactamente uno de los dos; el throw es defensa.
 */
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

/**
 * "Hoy" en `MM-DD-YYYY` para la zona del cliente. El conector/modelo lo usa como
 * ancla para traducir frases libres ("del mes pasado a la fecha") a `from`/`to`
 * explícitos — los LLMs no saben con certeza qué día es hoy. D-mapi-BW-017.
 */
export function resolveToday(
  timezone?: string | null,
  now: Date = new Date(),
): { today: string; timezone: string } {
  const tz = timezone ?? DEFAULT_BANK_TIMEZONE
  return { today: fmt(civilToday(now, tz)), timezone: tz }
}
