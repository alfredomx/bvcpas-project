'use client'

import { INTEGRATIONS_MOCK } from '../lib/mock-data'

export function IssActivity() {
  return (
    <ul className="flex flex-col rounded-md border bg-background">
      {INTEGRATIONS_MOCK.activity.map((entry, i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
        >
          <span className="w-14 shrink-0 text-xs text-muted-foreground">
            {entry.when}
          </span>
          <span className="min-w-0 flex-1">{entry.text}</span>
          <span className="inline-block size-2 shrink-0 rounded-full border" />
        </li>
      ))}
    </ul>
  )
}
