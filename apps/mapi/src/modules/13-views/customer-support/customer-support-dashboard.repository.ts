import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'

export interface DashboardFilters {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
}

export interface ClientStatsRow {
  client_id: string
  legal_name: string
  tier: string
  qbo_realm_id: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  transactions_filter: string
  draft_email_enabled: boolean
  cc_email: string | null

  followup_status: string | null
  followup_sent_at: Date | null
  followup_last_reply_at: Date | null
  followup_internal_notes: string | null

  uncats_count: number
  amas_count: number
  responded_count: number
  amount_total: string
  last_synced_at: Date | null
}

export interface MonthlyHistogramRow {
  client_id: string
  year: number
  month: number
  uncats: number
  amas: number
}

export interface PreviousYearTotalRow {
  client_id: string
  uncats: number
  amas: number
}

/**
 * Queries agregadas para el dashboard de Customer Support.
 *
 * Modelo: 3 queries paralelas (stats por cliente, monthly histogram,
 * previous year totals). Service compone el resultado.
 *
 * Razón de separar en queries en vez de un solo monstruo: legibilidad y
 * facilidad para tests unitarios. Performance es <100ms para 77 clientes,
 * irrelevante a este volumen.
 */
@Injectable()
export class CustomerSupportDashboardRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  /**
   * Stats por cliente activo: counts de uncats/amas/responded y amount total.
   * Trae también campos de cliente y followup necesarios para list y detail.
   */
  async getStatsByClient(filters: DashboardFilters): Promise<ClientStatsRow[]> {
    const rows = await this.db.execute(sql`
      SELECT
        c.id AS client_id,
        c.legal_name,
        c.tier,
        c.qbo_realm_id,
        c.primary_contact_name,
        c.primary_contact_email,
        c.transactions_filter,
        c.draft_email_enabled,
        c.cc_email,

        f.status AS followup_status,
        f.sent_at AS followup_sent_at,
        f.last_reply_at AS followup_last_reply_at,
        f.internal_notes AS followup_internal_notes,

        COUNT(t.id) FILTER (
          WHERE t.category IN ('uncategorized_expense', 'uncategorized_income')
            AND t.txn_date BETWEEN ${filters.from} AND ${filters.to}
        )::int AS uncats_count,

        COUNT(t.id) FILTER (
          WHERE t.category = 'ask_my_accountant'
            AND t.txn_date BETWEEN ${filters.from} AND ${filters.to}
        )::int AS amas_count,

        COALESCE(SUM(t.amount) FILTER (
          WHERE t.category IN ('uncategorized_expense', 'uncategorized_income')
            AND t.txn_date BETWEEN ${filters.from} AND ${filters.to}
        ), 0)::numeric(15,2) AS amount_total,

        (SELECT COUNT(*) FROM client_transaction_responses r
          WHERE r.client_id = c.id
            AND r.category IN ('uncategorized_expense', 'uncategorized_income')
            AND r.txn_date BETWEEN ${filters.from} AND ${filters.to}
        )::int AS responded_count,

        MAX(t.synced_at) FILTER (
          WHERE t.txn_date BETWEEN ${filters.from} AND ${filters.to}
        ) AS last_synced_at
      FROM clients c
      LEFT JOIN client_period_followups f ON f.client_id = c.id
      LEFT JOIN client_transactions t ON t.client_id = c.id
      WHERE c.status = 'active'
      GROUP BY c.id, f.status, f.sent_at, f.last_reply_at, f.internal_notes
      ORDER BY c.legal_name
    `)
    return rows as unknown as ClientStatsRow[]
  }

  /**
   * Histograma mensual del año actual (derivado del año del `to`).
   * Por (cliente × mes) → uncats + amas.
   */
  async getMonthlyHistogram(filters: DashboardFilters): Promise<MonthlyHistogramRow[]> {
    // Año actual = año del `to`. Solo cuenta transacciones de ese año.
    const rows = await this.db.execute(sql`
      SELECT
        client_id,
        EXTRACT(YEAR FROM txn_date)::int AS year,
        EXTRACT(MONTH FROM txn_date)::int AS month,
        COUNT(*) FILTER (
          WHERE category IN ('uncategorized_expense', 'uncategorized_income')
        )::int AS uncats,
        COUNT(*) FILTER (
          WHERE category = 'ask_my_accountant'
        )::int AS amas
      FROM client_transactions
      WHERE txn_date BETWEEN ${filters.from} AND ${filters.to}
        AND EXTRACT(YEAR FROM txn_date) = EXTRACT(YEAR FROM ${filters.to}::date)
      GROUP BY client_id, year, month
    `)
    return rows as unknown as MonthlyHistogramRow[]
  }

  /**
   * Totales del año anterior (derivado de `to.year - 1`). Sin desglose por mes.
   */
  async getPreviousYearTotals(filters: DashboardFilters): Promise<PreviousYearTotalRow[]> {
    const rows = await this.db.execute(sql`
      SELECT
        client_id,
        COUNT(*) FILTER (
          WHERE category IN ('uncategorized_expense', 'uncategorized_income')
        )::int AS uncats,
        COUNT(*) FILTER (
          WHERE category = 'ask_my_accountant'
        )::int AS amas
      FROM client_transactions
      WHERE txn_date BETWEEN ${filters.from} AND ${filters.to}
        AND EXTRACT(YEAR FROM txn_date) = EXTRACT(YEAR FROM ${filters.to}::date) - 1
      GROUP BY client_id
    `)
    return rows as unknown as PreviousYearTotalRow[]
  }
}
