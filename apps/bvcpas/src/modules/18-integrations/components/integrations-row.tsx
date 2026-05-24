'use client'

import { Play, RefreshCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { IntegrationConnection } from '../api/integrations.api'
import { useResumeConnection } from '../hooks/use-resume-connection'
import { useTestConnection } from '../hooks/use-test-connection'
import { STATUS_LABEL, deriveInitials } from '../lib/status-mapping'

export interface IntegrationsRowProps {
  connection: IntegrationConnection
  onSelect: () => void
  onPause: () => void
}

export function IntegrationsRow({
  connection,
  onSelect,
  onPause,
}: IntegrationsRowProps) {
  const resumeMutation = useResumeConnection()
  const testMutation = useTestConnection()

  const isPaused = connection.status === 'paused'
  const initials = deriveInitials(connection.providerLabel)
  const accountLabel = connection.label ?? '—'

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
          {initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold">{connection.providerLabel}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {accountLabel}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {connection.externalAccountId}
            </span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {STATUS_LABEL[connection.status]}
        </span>
      </div>

      {/* Footer: Pause/Resume (left) + Check status (right) */}
      <div className="flex items-center justify-between gap-2 border-t pt-3">
        {isPaused ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resumeMutation.isPending}
            onClick={(e) => {
              e.stopPropagation()
              resumeMutation.mutate(connection.id)
            }}
          >
            <Play className="size-4" />
            {resumeMutation.isPending ? 'Resuming…' : 'Resume'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation()
              onPause()
            }}
          >
            <X className="size-4" />
            Pause
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testMutation.isPending}
          onClick={(e) => {
            e.stopPropagation()
            testMutation.mutate(connection.id)
          }}
        >
          <RefreshCw className="size-4" />
          {testMutation.isPending ? 'Checking…' : 'Check status'}
        </Button>
      </div>
    </div>
  )
}
