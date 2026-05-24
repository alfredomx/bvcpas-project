'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/shared/section-header'

import type { Connection } from '../lib/mock-data'

import { DisconnectDialog } from './disconnect-dialog'
import { IntegrationSettingsSheet } from './integration-settings-sheet'
import { IntegrationsList } from './integrations-list'

export interface IntegrationsScreenProps {
  legalName: string
}

export function IntegrationsScreen({ legalName }: IntegrationsScreenProps) {
  const [selected, setSelected] = useState<Connection | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [disconnectTarget, setDisconnectTarget] = useState<Connection | null>(
    null,
  )

  const handleSelect = (c: Connection) => {
    setSelected(c)
    setSheetOpen(true)
  }

  const handleDisconnect = (c: Connection) => {
    setDisconnectTarget(c)
  }

  return (
    <div className="flex w-full flex-col gap-3 px-6 py-6">
      <SectionHeader
        kicker={`Integrations`}
        title={`${legalName}`}
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

      <IntegrationsList
        onSelect={handleSelect}
        onDisconnect={handleDisconnect}
      />

      <IntegrationSettingsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        connection={selected}
      />

      <DisconnectDialog
        open={disconnectTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDisconnectTarget(null)
        }}
        connectionTitle={disconnectTarget?.title ?? ''}
      />
    </div>
  )
}
