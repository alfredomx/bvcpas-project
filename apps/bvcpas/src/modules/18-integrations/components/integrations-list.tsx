'use client'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import type { IntegrationConnection } from '../api/integrations.api'

import { IntegrationsRow } from './integrations-row'

export interface IntegrationsListProps {
  connections: IntegrationConnection[]
  onSelect: (connection: IntegrationConnection) => void
  onPause: (connection: IntegrationConnection) => void
}

export function IntegrationsList({
  connections,
  onSelect,
  onPause,
}: IntegrationsListProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {connections.map((c) => (
          <IntegrationsRow
            key={c.id}
            connection={c}
            onSelect={() => onSelect(c)}
            onPause={() => onPause(c)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-muted-foreground">
          You can have multiple accounts of the same provider — each maps to
          QuickBooks independently.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => toast.message('Add another integration coming soon.')}
        >
          + Add another integration
        </Button>
      </div>
    </section>
  )
}
