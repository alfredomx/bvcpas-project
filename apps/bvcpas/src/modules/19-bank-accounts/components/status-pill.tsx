// Pill compartido por logins y accounts: bullet de color + label.

import type { StatusDef } from '../lib/status-labels'

export function StatusPill({ status }: { status: StatusDef }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className={`inline-block size-1.5 rounded-full ${status.dot}`} />
      {status.label}
    </span>
  )
}
