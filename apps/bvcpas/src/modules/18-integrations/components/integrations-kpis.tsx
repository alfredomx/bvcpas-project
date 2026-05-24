'use client'

import { INTEGRATIONS_MOCK } from '../lib/mock-data'

export function IntegrationsKpis() {
  return (
    <div className="grid grid-cols-2 divide-x rounded-md border bg-background md:grid-cols-5">
      {INTEGRATIONS_MOCK.kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="flex flex-col gap-1 px-4 py-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {kpi.label}
          </p>
          <span className="text-2xl font-bold tabular-nums">{kpi.value}</span>
          <p className="text-xs text-muted-foreground">{kpi.sub}</p>
        </div>
      ))}
    </div>
  )
}
