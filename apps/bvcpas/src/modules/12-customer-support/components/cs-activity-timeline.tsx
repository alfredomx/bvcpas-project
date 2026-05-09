// Histograma horizontal por mes. La métrica que se grafica depende
// de la tab activa de <CsTransactions>: 'uncategorized' grafica
// `bucket.uncats`, 'amas' grafica `bucket.amas`. Mes anterior
// highlighted.

import { dashboardMonth, MONTH_LABELS } from '../lib/date-range'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'
import { cn } from '@/lib/utils'

export type ActivityTimelineMode = 'uncategorized' | 'amas'

export interface CsActivityTimelineProps {
  monthly: UncatsDetailResponse['monthly']
  /** Métrica que se grafica. Default: 'uncategorized'. */
  mode?: ActivityTimelineMode
  /** "now" para resaltar el mes anterior. Default: new Date(). */
  now?: Date
}

const MAX_BAR_HEIGHT = 80 // px

const MODE_CONFIG: Record<
  ActivityTimelineMode,
  { metric: 'uncats' | 'amas'; label: string; unit: string }
> = {
  uncategorized: { metric: 'uncats', label: 'uncats', unit: 'uncats' },
  amas: { metric: 'amas', label: 'ask my accountant', unit: 'AMAs' },
}

export function CsActivityTimeline({
  monthly,
  mode = 'uncategorized',
  now = new Date(),
}: CsActivityTimelineProps) {
  const highlightMonth = dashboardMonth(now).month
  const config = MODE_CONFIG[mode]
  const values = monthly.by_month.map((b) => b[config.metric])
  const maxValue = Math.max(1, ...values)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity timeline</p>
        <p className="text-xs text-muted-foreground">
          {config.label} per month · {MONTH_LABELS[highlightMonth - 1]} highlighted
        </p>
      </div>
      <div className="flex items-end gap-2 border-b pb-1" style={{ height: MAX_BAR_HEIGHT + 24 }}>
        {monthly.by_month.map((bucket) => {
          const value = bucket[config.metric]
          const heightPct = (value / maxValue) * 100
          const active = bucket.month === highlightMonth
          return (
            <div
              key={bucket.month}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${MONTH_LABELS[bucket.month - 1]}: ${value} ${config.unit}`}
            >
              <span className="text-[10px] text-muted-foreground">
                {value > 0 ? value : ''}
              </span>
              <div
                className={cn(
                  'w-full rounded-sm',
                  active ? 'bg-foreground' : 'bg-muted-foreground/30',
                )}
                style={{ height: `${Math.max(2, heightPct)}%` }}
                aria-label={`${MONTH_LABELS[bucket.month - 1]} ${value} ${config.unit}`}
              />
              <span
                className={cn(
                  'text-[10px]',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {MONTH_LABELS[bucket.month - 1].slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
