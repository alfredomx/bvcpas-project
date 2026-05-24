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

import type { IntegrationConnection } from '../api/integrations.api'
import { STATUS_LABEL, deriveInitials } from '../lib/status-mapping'

import { IssActivity } from './iss-activity'
import { IssFieldMapping } from './iss-field-mapping'
import { IssSyncSettings } from './iss-sync-settings'
import { PauseDialog } from './pause-dialog'

export interface IntegrationSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: IntegrationConnection | null
}

export function IntegrationSettingsSheet({
  open,
  onOpenChange,
  connection,
}: IntegrationSettingsSheetProps) {
  const [pauseOpen, setPauseOpen] = useState(false)

  if (!connection) return null

  const initials = deriveInitials(connection.providerLabel)
  const accountLabel = connection.label ?? '—'

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
                  {initials}
                </div>
                <div className="flex flex-col gap-1">
                  <SheetTitle className="text-lg">
                    {connection.providerLabel}
                  </SheetTitle>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {accountLabel}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {connection.externalAccountId}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABEL[connection.status]} ·{' '}
                    {connection.authType === 'api_key' ? 'API key' : 'OAuth'}
                  </p>
                </div>
              </div>
              {connection.status !== 'paused' && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setPauseOpen(true)}
                  >
                    <X className="size-3.5" />
                    Pause
                  </Button>
                </div>
              )}
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
                {connection.authType === 'api_key' ? 'API key' : 'OAuth'}
              </p>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-6">
              <TabsContent value="mapping" className="m-0">
                <IssFieldMapping />
              </TabsContent>
              <TabsContent value="sync" className="m-0">
                <IssSyncSettings
                  onDisconnectClick={() => setPauseOpen(true)}
                />
              </TabsContent>
              <TabsContent value="activity" className="m-0">
                <IssActivity />
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      <PauseDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        connectionId={connection.id}
        connectionTitle={connection.providerLabel}
      />
    </>
  )
}
