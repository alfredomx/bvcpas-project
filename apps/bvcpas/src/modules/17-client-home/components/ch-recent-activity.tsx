'use client'

import { HOME_MOCK } from '../lib/mock-data'

export function ChRecentActivity() {
  return (
    <section className="flex flex-col gap-2 rounded-md border bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recent activity
      </p>
      <ul className="flex flex-col gap-2">
        {HOME_MOCK.recent.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">{a.when}</span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              {a.badge}
            </span>
            <span className="text-foreground">{a.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
