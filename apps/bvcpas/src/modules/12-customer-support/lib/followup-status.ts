// Regla única para calcular el siguiente `followup.status` según el
// avance de las responses del período y si ya hubo envío este mes.
//
// La consume `<TxDetailModal>` (tras Save/Delete) y `<CsTransactions>`
// (tras Sync). Mantener una sola fuente evita que las dos reglas se
// desincronicen al evolucionar (ver fix-followup-status-transitions.md).

import type { components } from '@/lib/api/schema'

export type FollowupStatus = components['schemas']['FollowupDto']['status']

export interface ComputeNextStatusInput {
  /** Progreso resultante del período (0–100). */
  progressPct: number
  /** `followup.sent_at` actual (ISO o null). */
  sentAt: string | null
  /** `now` inyectable para tests. Default `new Date()`. */
  now?: Date
}

/**
 * Regla:
 *
 *  - `progress_pct === 0` y `sent_at` es del mismo mes/año actual → 'sent'
 *  - `progress_pct === 0` y `sent_at` es null o de otro mes → 'ready_to_send'
 *  - `0 < progress_pct < 100` → 'partial_reply'
 *  - `progress_pct === 100` → 'complete'
 *
 * "Mismo mes/año" se evalúa contra `now` en UTC para consistencia con
 * el resto del módulo (ver `lib/date-range.ts`).
 */
export function computeNextFollowupStatus({
  progressPct,
  sentAt,
  now = new Date(),
}: ComputeNextStatusInput): FollowupStatus {
  if (progressPct >= 100) return 'complete'
  if (progressPct > 0) return 'partial_reply'

  // progressPct === 0: si ya se envió este mes, vuelve al baseline 'sent';
  // si no, queda 'ready_to_send'.
  if (!sentAt) return 'ready_to_send'
  const sent = new Date(sentAt)
  if (Number.isNaN(sent.getTime())) return 'ready_to_send'
  const sameMonthAndYear =
    sent.getUTCFullYear() === now.getUTCFullYear() &&
    sent.getUTCMonth() === now.getUTCMonth()
  return sameMonthAndYear ? 'sent' : 'ready_to_send'
}
