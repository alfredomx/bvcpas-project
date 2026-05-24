'use client'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import type { Connection } from '../lib/mock-data'
import { INTEGRATIONS_MOCK } from '../lib/mock-data'

import { IntegrationsRow } from './integrations-row'

export interface IntegrationsListProps {
  onSelect: (connection: Connection) => void
  onDisconnect: (connection: Connection) => void
}

export function IntegrationsList({
  onSelect,
  onDisconnect,
}: IntegrationsListProps) {
  return (
    <section className="flex flex-col gap-3">
      {/* <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Connected accounts</h2>
          <p className="text-xs text-muted-foreground">
            Click a row to map fields, change settings, or disconnect.
          </p>
        </div>
      </div> */}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {INTEGRATIONS_MOCK.connections.map((c) => (
          <IntegrationsRow
            key={c.id}
            connection={c}
            onSelect={() => onSelect(c)}
            onDisconnect={() => onDisconnect(c)}
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
