// Grid de KPIs del cliente. 6 stats: At risk, Total uncats,
// Silent streak, AMA's, Total backlog, Progress.

import { formatAmount, silentStreakInMonths } from '../lib/format'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

export interface CsStatsGridProps {
  stats: UncatsDetailResponse['stats']
}

interface StatCellProps {
  label: string
  value: string
}

function StatCell({ label, value }: StatCellProps) {
  return (
    <div className="flex flex-col gap-1 border-l px-4 py-3 first:border-l-0">
      <span className="text-2xl font-semibold">{value}</span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

export function CsStatsGrid({ stats }: CsStatsGridProps) {
  const totalBacklog = stats.uncats_count + stats.amas_count
  const silentMonths = silentStreakInMonths(stats.silent_streak_days)
  const silentDisplay =
    silentMonths > 0 ? `${silentMonths}mo` : `${Math.max(0, Math.floor(stats.silent_streak_days))}d`

  return (
    <div className="grid grid-cols-2 divide-x rounded-md border md:grid-cols-6">
      <StatCell label="At risk" value={formatAmount(stats.amount_total)} />
      <StatCell label="Total uncats" value={String(stats.uncats_count)} />
      <StatCell label="Silent streak" value={silentDisplay} />
      <StatCell label="AMA's" value={String(stats.amas_count)} />
      <StatCell label="Total backlog" value={String(totalBacklog)} />
      <StatCell label="Progress" value={`${Math.round(stats.progress_pct)}%`} />
    </div>
  )
}
