'use client'

// Header de la pantalla pública.
// Izquierda: kicker "Transaction report · Uncategorized", título con
// el legal_name y meta con el período (mes anterior al actual).
// Derecha: 4 KPI cards (Transactions, Total amount, Pending answers, Done).

import { dashboardMonth } from '@/modules/12-customer-support/lib/date-range'

import type { PublicUncatsResponse } from '../api/public-uncats.api'
import { deriveStats } from '../lib/derive-stats'

export interface PuHeaderProps {
  client: PublicUncatsResponse['client']
  items: PublicUncatsResponse['items']
}

function formatMoney(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '$0.00'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

interface KpiProps {
  label: string
  value: string
}

function Kpi({ label, value }: KpiProps) {
  return (
    <div className="flex min-w-25 flex-col items-center gap-1 px-5 py-2.5 not-last:border-r">
      <span className="text-base font-bold tabular-nums leading-tight">
        {value}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export function PuHeader({ client, items }: PuHeaderProps) {
  const stats = deriveStats(items)
  const period = dashboardMonth(new Date())
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Transaction report · Uncategorized
        </p>
        <h1 className="text-xl font-semibold leading-tight tracking-tight">
          {client.legal_name}
        </h1>
        <p className="text-[11px] text-muted-foreground">
          <span className="opacity-60">period</span> {period.label} {period.year}
        </p>
      </div>
      <div className="hidden overflow-hidden rounded-md border bg-muted/40 md:flex">
        <Kpi label="Transactions" value={String(stats.transactionsCount)} />
        <Kpi label="Total amount" value={formatMoney(stats.totalAmount)} />
        <Kpi label="Done" value={`${stats.progressPct}%`} />
      </div>
    </header>
  )
}
