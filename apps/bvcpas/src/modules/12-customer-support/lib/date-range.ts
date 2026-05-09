// Helpers de fecha del dashboard de Customer Support.
//
// Regla del backend (D-bvcpas-031): el periodo cierra al último día
// del mes anterior. El "mes actual del dashboard" siempre es ese mes
// anterior, nunca el mes vivo.

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export interface Range {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
}

/**
 * Calcula el rango que el backend espera:
 * - from: 1 de enero del año pasado.
 * - to: último día del mes anterior a `now`.
 *
 * Ejemplo: si hoy es 2026-05-09 → { from: '2025-01-01', to: '2026-04-30' }.
 */
export function computeRange(now: Date): Range {
  const fromYear = now.getUTCFullYear() - 1
  const from = `${fromYear}-01-01`

  // Último día del mes anterior = día 0 del mes actual (UTC).
  const lastDayPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const to = `${lastDayPrev.getUTCFullYear()}-${pad2(
    lastDayPrev.getUTCMonth() + 1,
  )}-${pad2(lastDayPrev.getUTCDate())}`

  return { from, to }
}

export interface DashboardMonth {
  /** 1..12 */
  month: number
  year: number
  /** 'January' .. 'December' */
  label: string
}

/**
 * "Mes actual del dashboard" = mes anterior real.
 * Si hoy es 2026-05-09 → { month: 4, year: 2026, label: 'April' }.
 */
export function dashboardMonth(now: Date): DashboardMonth {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const month = prev.getUTCMonth() + 1
  const year = prev.getUTCFullYear()
  return {
    month,
    year,
    label: MONTH_LABELS[month - 1],
  }
}
