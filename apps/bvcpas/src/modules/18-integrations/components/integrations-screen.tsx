'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/shared/section-header'

import type { IntegrationConnection } from '../api/integrations.api'
import { useClientIntegrations } from '../hooks/use-client-integrations'

import { IntegrationSettingsSheet } from './integration-settings-sheet'
import { IntegrationsList } from './integrations-list'
import { PauseDialog } from './pause-dialog'

export interface IntegrationsScreenProps {
  clientId: string
  legalName: string
}

export function IntegrationsScreen({
  clientId,
  legalName,
}: IntegrationsScreenProps) {
  const [selected, setSelected] = useState<IntegrationConnection | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pauseTarget, setPauseTarget] = useState<IntegrationConnection | null>(
    null,
  )

  const query = useClientIntegrations(clientId)

  const handleSelect = (c: IntegrationConnection) => {
    setSelected(c)
    setSheetOpen(true)
  }

  const handlePause = (c: IntegrationConnection) => {
    setPauseTarget(c)
  }

  return (
    <div className="flex w-full flex-col gap-3 px-6 py-6">
      <SectionHeader
        kicker={`Integrations`}
        title={legalName}
        description="Add data sources for this client. You can connect multiple accounts per provider (e.g. two Clover accounts) and map each one to QuickBooks fields independently."
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => toast.message('New integration flow coming soon.')}
          >
            + New Integration
          </Button>
        }
      />

      {/* TODO: para habilitar cuando ya tengamos mas integraciones */}
      {/* <IntegrationsKpis /> */}

      {query.isLoading && <IntegrationsLoading />}

      {query.isError && (
        <IntegrationsError
          message={query.error?.message ?? 'Could not load integrations.'}
          onRetry={() => query.refetch()}
        />
      )}

      {query.data && query.data.connections.length === 0 && (
        <IntegrationsEmpty />
      )}

      {query.data && query.data.connections.length > 0 && (
        <IntegrationsList
          connections={query.data.connections}
          onSelect={handleSelect}
          onPause={handlePause}
        />
      )}

      <IntegrationSettingsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        connection={selected}
      />

      <PauseDialog
        open={pauseTarget !== null}
        onOpenChange={(o) => {
          if (!o) setPauseTarget(null)
        }}
        connectionId={pauseTarget?.id ?? null}
        connectionTitle={pauseTarget?.providerLabel ?? ''}
      />
    </div>
  )
}

function IntegrationsLoading() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex h-37 animate-pulse flex-col gap-3 rounded-md border bg-muted/30 p-4"
        />
      ))}
    </div>
  )
}

function IntegrationsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border bg-muted/20 px-6 py-10 text-center">
      <p className="text-sm font-medium">No integrations yet</p>
      <p className="text-xs text-muted-foreground">
        Connect Clover or Square to start importing data for this client.
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-2"
        onClick={() => toast.message('New integration flow coming soon.')}
      >
        + Connect your first integration
      </Button>
    </div>
  )
}

function IntegrationsError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-700">
        Could not load integrations
      </p>
      <p className="text-xs text-red-600">{message}</p>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  )
}
