// Helpers de presentación del dashboard de Customer Support.
// Cero clases CSS — solo strings.

/**
 * Formato preciso de monto en USD: $X,XXX.XX con 2 decimales y separador
 * de miles. `value` viene como string desde mapi (decimal Postgres,
 * D-bvcpas-020). Conserva el signo negativo si aplica.
 *
 * Ejemplos: "200.00" → "$200.00"; "60401.23" → "$60,401.23";
 * "-32.5" → "-$32.50".
 */
export function formatAmount(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '$0.00'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${sign}$${formatted}`
}

/** Convierte días en meses enteros (truncando). */
export function silentStreakInMonths(days: number): number {
  if (!Number.isFinite(days) || days < 30) return 0
  return Math.floor(days / 30)
}

/**
 * Texto del silent streak: "Xmo silent" si >=30d, "Xd silent" si menos.
 */
export function formatSilentStreak(days: number): string {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0
  const months = silentStreakInMonths(safeDays)
  if (months > 0) return `${months}mo silent`
  return `${safeDays}d silent`
}

/** Convierte 'awaiting_reply' → 'awaiting reply'. Útil para badges. */
export function formatFollowupStatus(status: string): string {
  return status.replace(/_/g, ' ')
}
