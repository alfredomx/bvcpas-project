import { Injectable } from '@nestjs/common'
import { ClientsRepository } from '../../11-clients/clients.repository'
import { ClientNotFoundError } from '../../11-clients/clients.errors'
import {
  type ClientStatsRow,
  CustomerSupportDashboardRepository,
  type DashboardFilters,
  type MonthlyHistogramRow,
  type PreviousYearTotalRow,
} from './customer-support-dashboard.repository'

export interface MonthlyDataPoint {
  month: number // 1..12
  uncats: number
  amas: number
}

export interface PreviousYearTotal {
  uncats: number
  amas: number
}

export interface ClientDashboardListItem {
  client_id: string
  legal_name: string
  tier: string
  qbo_realm_id: string | null
  followup: {
    status: string
    sent_at: string | null
  }
  stats: {
    uncats_count: number
    amas_count: number
    responded_count: number
    progress_pct: number
    amount_total: string
    last_synced_at: string | null
  }
  monthly: {
    previous_year_total: PreviousYearTotal
    by_month: MonthlyDataPoint[]
  }
}

export interface ClientDashboardDetail {
  client: {
    id: string
    legal_name: string
    tier: string
    qbo_realm_id: string | null
    primary_contact_name: string | null
    primary_contact_email: string | null
    transactions_filter: string
    draft_email_enabled: boolean
    cc_email: string | null
  }
  followup: {
    status: string
    sent_at: string | null
    last_reply_at: string | null
    internal_notes: string | null
  }
  stats: ClientDashboardListItem['stats'] & {
    silent_streak_days: number
  }
  monthly: ClientDashboardListItem['monthly']
}

@Injectable()
export class CustomerSupportDashboardService {
  constructor(
    private readonly repo: CustomerSupportDashboardRepository,
    private readonly clientsRepo: ClientsRepository,
  ) {}

  async listAll(filters: DashboardFilters): Promise<ClientDashboardListItem[]> {
    const [stats, monthly, previousYear] = await Promise.all([
      this.repo.getStatsByClient(filters),
      this.repo.getMonthlyHistogram(filters),
      this.repo.getPreviousYearTotals(filters),
    ])

    return stats.map((s) => buildListItem(s, monthly, previousYear))
  }

  async getForClient(clientId: string, filters: DashboardFilters): Promise<ClientDashboardDetail> {
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)

    const [stats, monthly, previousYear] = await Promise.all([
      this.repo.getStatsByClient(filters),
      this.repo.getMonthlyHistogram(filters),
      this.repo.getPreviousYearTotals(filters),
    ])

    const clientStats = stats.find((s) => s.client_id === clientId)
    const listItem = clientStats
      ? buildListItem(clientStats, monthly, previousYear)
      : buildEmptyListItem(client)

    const silentStreakDays = computeSilentStreakDays(
      coerceDate(clientStats?.followup_last_reply_at),
      coerceDate(clientStats?.followup_sent_at),
    )

    return {
      client: {
        id: client.id,
        legal_name: client.legalName,
        tier: client.tier,
        qbo_realm_id: client.qboRealmId,
        primary_contact_name: client.primaryContactName,
        primary_contact_email: client.primaryContactEmail,
        transactions_filter: client.transactionsFilter,
        draft_email_enabled: client.draftEmailEnabled,
        cc_email: client.ccEmail,
      },
      followup: {
        status: clientStats?.followup_status ?? 'pending',
        sent_at: toIsoOrNull(clientStats?.followup_sent_at),
        last_reply_at: toIsoOrNull(clientStats?.followup_last_reply_at),
        internal_notes: clientStats?.followup_internal_notes ?? null,
      },
      stats: { ...listItem.stats, silent_streak_days: silentStreakDays },
      monthly: listItem.monthly,
    }
  }
}

function buildListItem(
  s: ClientStatsRow,
  allMonthly: MonthlyHistogramRow[],
  allPrevYear: PreviousYearTotalRow[],
): ClientDashboardListItem {
  const myMonthly = allMonthly.filter((m) => m.client_id === s.client_id)
  const myPrevYear = allPrevYear.find((p) => p.client_id === s.client_id)

  return {
    client_id: s.client_id,
    legal_name: s.legal_name,
    tier: s.tier,
    qbo_realm_id: s.qbo_realm_id,
    followup: {
      status: s.followup_status ?? 'pending',
      sent_at: toIsoOrNull(s.followup_sent_at),
    },
    stats: {
      uncats_count: s.uncats_count,
      amas_count: s.amas_count,
      responded_count: s.responded_count,
      progress_pct: computeProgressPct(s.responded_count, s.uncats_count),
      amount_total: s.amount_total,
      last_synced_at: toIsoOrNull(s.last_synced_at),
    },
    monthly: {
      previous_year_total: {
        uncats: myPrevYear?.uncats ?? 0,
        amas: myPrevYear?.amas ?? 0,
      },
      by_month: buildByMonth(myMonthly),
    },
  }
}

function buildEmptyListItem(client: {
  id: string
  legalName: string
  tier: string
  qboRealmId: string | null
}): ClientDashboardListItem {
  return {
    client_id: client.id,
    legal_name: client.legalName,
    tier: client.tier,
    qbo_realm_id: client.qboRealmId,
    followup: { status: 'pending', sent_at: null },
    stats: {
      uncats_count: 0,
      amas_count: 0,
      responded_count: 0,
      progress_pct: 0,
      amount_total: '0.00',
      last_synced_at: null,
    },
    monthly: {
      previous_year_total: { uncats: 0, amas: 0 },
      by_month: buildByMonth([]),
    },
  }
}

/**
 * Postgres-js a veces devuelve timestamptz como string ISO en vez de Date,
 * dependiendo del query path (db.execute con sql raw vs query builder
 * tipado). Estas helpers normalizan cualquiera de las dos a string ISO o Date.
 */
function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function buildByMonth(rows: MonthlyHistogramRow[]): MonthlyDataPoint[] {
  const map = new Map<number, MonthlyDataPoint>()
  for (let m = 1; m <= 12; m++) {
    map.set(m, { month: m, uncats: 0, amas: 0 })
  }
  for (const r of rows) {
    const point = map.get(r.month)
    if (point) {
      point.uncats = r.uncats
      point.amas = r.amas
    }
  }
  return Array.from(map.values())
}

export function computeProgressPct(responded: number, uncats: number): number {
  if (uncats === 0) return 0
  return Math.round((responded / uncats) * 100)
}

export function computeSilentStreakDays(lastReplyAt: Date | null, sentAt: Date | null): number {
  // Prioriza last_reply_at; si null, usa sent_at; si ambos null, 0.
  const reference = lastReplyAt ?? sentAt
  if (!reference) return 0
  const diffMs = Date.now() - reference.getTime()
  const days = Math.floor(diffMs / (24 * 3600 * 1000))
  return Math.max(0, days)
}
