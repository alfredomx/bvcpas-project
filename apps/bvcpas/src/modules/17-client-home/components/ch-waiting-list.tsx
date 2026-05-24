'use client'

import { HOME_MOCK } from '../lib/mock-data'

export function ChWaitingList() {
  const list = HOME_MOCK.waiting
  return (
    <section className="flex flex-col gap-2 rounded-md border bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Waiting on the client
        </p>
        <span className="text-xs text-muted-foreground">{list.length} items</span>
      </div>
      <ul className="flex flex-col">
        {list.map((it) => (
          <li
            key={it.title}
            className="flex items-start gap-2 border-b py-2 last:border-b-0"
          >
            <span className="mt-1.5 inline-block size-2 shrink-0 rounded-full border" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{it.title}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {it.due}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{it.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
