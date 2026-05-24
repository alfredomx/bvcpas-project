'use client'

import { RefreshCw, X } from 'lucide-react'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import type { Connection } from '../lib/mock-data'

const STATUS_LABEL: Record<Connection['status'], string> = {
  connected: 'Connected',
  reauth: 'Re-auth needed',
  failed: 'Sync failed',
}

export interface IntegrationsRowProps {
  connection: Connection
  onSelect: () => void
  onDisconnect: () => void
}

export function IntegrationsRow({
  connection,
  onSelect,
  onDisconnect,
}: IntegrationsRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-md border bg-background p-4 transition-colors hover:bg-accent/30"
    >
      {/* Header: Avatar + Title + label + domain + Status */}
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded border bg-muted text-xs font-semibold">
          {connection.initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold">{connection.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {connection.accountLabel}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {connection.accountDomain}
            </span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {STATUS_LABEL[connection.status]}
        </span>
      </div>

      {/* Footer: Actions */}
      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={(e) => {
            e.stopPropagation()
            onDisconnect()
          }}
        >
          <X className="size-4" />
          Disconnect
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            toast.message(`Checking status for ${connection.title}...`)
          }}
        >
          <RefreshCw className="size-4" />
          Check status
        </Button>
      </div>
    </div>
  )
}
