// Tipos del módulo 13-dashboards.
//
// Match 1:1 con `apps/mapi/src/modules/13-dashboards/`. Los endpoints
// agregan stats por cliente para pintar dashboards específicos.
//
// snake_case 1:1 con el response del backend (D-bvcpas-020).
// Validado contra `dev.alfredo.mx/v1/dashboards/customer-support`
// 2026-05-06.

import type { ClientTier } from '@/modules/11-clients/types'

/**
 * Status del followup mensual de un cliente. Replica `FOLLOWUP_STATUSES`
 * del schema de mapi
 * (`apps/mapi/src/db/schema/client-period-followups.ts`).
 */
export type FollowupStatus =
  | 'pending'
  | 'ready_to_send'
  | 'sent'
  | 'awaiting_reply'
  | 'partial_reply'
  | 'complete'
  | 'review_needed'

/**
 * Período del request: rango de fechas que el frontend mandó al backend.
 * El backend ecoa esto en la respuesta para que el frontend confirme
 * qué rango se usó realmente.
 */
export interface DashboardPeriod {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
}

/**
 * Stats agregados de un cliente para el dashboard customer-support.
 *
 * `amount_total` es string (no number) porque el backend usa decimal
 * de Postgres y serializa como string para no perder precisión.
 *
 * `last_synced_at` es null si nunca se hizo sync; es timestamp ISO si
 * sí.
 */
export interface CustomerSupportStats {
  uncats_count: number
  amas_count: number
  responded_count: number
  progress_pct: number
  amount_total: string
  last_synced_at: string | null
}

/**
 * Estado del followup del cliente para el periodo activo (último
 * registrado, no necesariamente el del mes actual).
 */
export interface CustomerSupportFollowup {
  status: FollowupStatus
  /** ISO timestamp; null si no se ha enviado. */
  sent_at: string | null
}

/**
 * Una fila de uncats/amas para un mes específico.
 */
export interface MonthlyBucket {
  /** 1–12 */
  month: number
  uncats: number
  amas: number
}

/**
 * Histograma mensual del año actual + total del año anterior agregado.
 */
export interface CustomerSupportMonthly {
  previous_year_total: { uncats: number; amas: number }
  by_month: MonthlyBucket[]
}

/**
 * Una entrada de la lista maestra del dashboard customer-support.
 *
 * Devuelve un cliente con sus stats agregados — todo lo necesario para
 * pintar una fila de la sidebar (uncats count, monto, status pill,
 * sparkline 12 meses).
 */
export interface CustomerSupportListItem {
  client_id: string
  legal_name: string
  tier: ClientTier
  qbo_realm_id: string | null
  followup: CustomerSupportFollowup
  stats: CustomerSupportStats
  monthly: CustomerSupportMonthly
}

/**
 * Response completo de `GET /v1/dashboards/customer-support`.
 */
export interface CustomerSupportListResponse {
  period: DashboardPeriod
  items: CustomerSupportListItem[]
}
