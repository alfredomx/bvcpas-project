'use client'

import Link from 'next/link'

import type { ModuleCardData } from '../lib/mock-data'

export function ChModuleCard({
  clientId,
  data,
}: {
  clientId: string
  data: ModuleCardData
}) {
  const Icon = data.icon
  return (
    <Link
      href={`/dashboard/clients/${clientId}/${data.slug}`}
      className="group flex flex-col gap-3 rounded-md border bg-background p-4 transition-colors hover:border-foreground/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded border bg-muted/40 text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-semibold leading-tight">{data.title}</p>
            <p className="text-xs text-muted-foreground">{data.subtitle}</p>
          </div>
        </div>
        {data.badge && (
          <span className="shrink-0 rounded border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {data.badge.text}
          </span>
        )}
      </div>

      {data.progressFilled !== undefined && data.progressTotal && (
        <div className="flex gap-1">
          {Array.from({ length: data.progressTotal }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded ${
                i < data.progressFilled! ? 'bg-foreground' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {data.rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t pt-2 text-xs font-medium text-muted-foreground group-hover:text-foreground">
        {data.cta} →
      </div>
    </Link>
  )
}
