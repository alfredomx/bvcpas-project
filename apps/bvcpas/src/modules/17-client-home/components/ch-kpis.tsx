'use client'

import { HOME_MOCK, type KpiData } from '../lib/mock-data'

export function ChKpis() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {HOME_MOCK.kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  )
}

function KpiCard({ kpi }: { kpi: KpiData }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {kpi.label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{kpi.value}</span>
        {kpi.meta && (
          <span className="text-sm text-muted-foreground">{kpi.meta}</span>
        )}
      </div>
      {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
    </div>
  )
}
