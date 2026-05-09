// Histograma horizontal de uncats por mes. Mes anterior highlighted.

import { dashboardMonth, MONTH_LABELS } from '../lib/date-range'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'
import { cn } from '@/lib/utils'

export interface CsActivityTimelineProps {
  monthly: UncatsDetailResponse['monthly']
  /** "now" para resaltar el mes anterior. Default: new Date(). */
  now?: Date
}

const MAX_BAR_HEIGHT = 80 // px

export function CsActivityTimeline({ monthly, now = new Date() }: CsActivityTimelineProps) {
  const highlightMonth = dashboardMonth(now).month
  const maxValue = Math.max(1, ...monthly.by_month.map((b) => b.uncats))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity timeline</p>
        <p className="text-xs text-muted-foreground">
          uncats per month · {MONTH_LABELS[highlightMonth - 1]} highlighted
        </p>
      </div>
      <div className="flex items-end gap-2 border-b pb-1" style={{ height: MAX_BAR_HEIGHT + 24 }}>
        {monthly.by_month.map((bucket) => {
          const heightPct = (bucket.uncats / maxValue) * 100
          const active = bucket.month === highlightMonth
          return (
            <div
              key={bucket.month}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${MONTH_LABELS[bucket.month - 1]}: ${bucket.uncats} uncats`}
            >
              <span className="text-[10px] text-muted-foreground">
                {bucket.uncats > 0 ? bucket.uncats : ''}
              </span>
              <div
                className={cn(
                  'w-full rounded-sm',
                  active ? 'bg-foreground' : 'bg-muted-foreground/30',
                )}
                style={{ height: `${Math.max(2, heightPct)}%` }}
                aria-label={`${MONTH_LABELS[bucket.month - 1]} ${bucket.uncats} uncats`}
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
