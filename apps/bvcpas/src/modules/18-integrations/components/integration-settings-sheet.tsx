'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { Connection } from '../lib/mock-data'

import { DisconnectDialog } from './disconnect-dialog'
import { IssActivity } from './iss-activity'
import { IssFieldMapping } from './iss-field-mapping'
import { IssSyncSettings } from './iss-sync-settings'

const STATUS_LABEL: Record<Connection['status'], string> = {
  connected: 'Connected',
  reauth: 'Re-auth needed',
  failed: 'Sync failed',
}

export interface IntegrationSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: Connection | null
}

export function IntegrationSettingsSheet({
  open,
  onOpenChange,
  connection,
}: IntegrationSettingsSheetProps) {
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  if (!connection) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-[720px] sm:max-w-[720px] p-0"
        >
          <SheetHeader className="gap-3 border-b p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded border bg-muted text-sm font-semibold">
                  {connection.initials}
                </div>
                <div className="flex flex-col gap-1">
                  <SheetTitle className="text-lg">{connection.title}</SheetTitle>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {connection.accountLabel}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {connection.accountDomain}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ● {connection.statusDetail ?? STATUS_LABEL[connection.status]}{' '}
                    · Last sync · {connection.lastSyncRelative}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDisconnectOpen(true)}
                >
                  <X className="size-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="mapping" className="flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-2">
              <TabsList>
                <TabsTrigger value="mapping">Field mapping</TabsTrigger>
                <TabsTrigger value="sync">Sync settings</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <p className="text-xs text-muted-foreground">
                Connector v3.4 · OAuth
              </p>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-6">
              <TabsContent value="mapping" className="m-0">
                <IssFieldMapping />
              </TabsContent>
              <TabsContent value="sync" className="m-0">
                <IssSyncSettings
                  onDisconnectClick={() => setDisconnectOpen(true)}
                />
              </TabsContent>
              <TabsContent value="activity" className="m-0">
                <IssActivity />
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      <DisconnectDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        connectionTitle={connection.title}
      />
    </>
  )
}
