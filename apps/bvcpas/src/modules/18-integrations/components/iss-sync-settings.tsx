'use client'

import { Settings2, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface RowProps {
  title: string
  description: string
  action: React.ReactNode
}

function CardSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-md border bg-background">
      <p className="border-b px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

function Row({ title, description, action }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export interface IssSyncSettingsProps {
  onDisconnectClick: () => void
}

export function IssSyncSettings({ onDisconnectClick }: IssSyncSettingsProps) {
  return (
    <div className="flex flex-col gap-4">
      <CardSection label="Sync schedule">
        <Row
          title="Auto-sync new transactions"
          description="Runs every 15 minutes during business hours"
          action={<Switch defaultChecked />}
        />
        <Row
          title="Auto-categorize using rules"
          description="Apply category rules saved in QuickBooks before import"
          action={<Switch defaultChecked />}
        />
        <Row
          title="Send uncat. notification to client"
          description="Email client when 5+ uncategorized items pile up"
          action={<Switch />}
        />
      </CardSection>

      <CardSection label="Filters & defaults">
        <Row
          title="Start date"
          description="Import transactions from Jan 1, 2025 onwards"
          action={
            <Button type="button" variant="outline" size="sm">
              <Settings2 className="size-3.5" />
              Edit
            </Button>
          }
        />
        <Row
          title="Default deposit account"
          description="10001 · RBFC Checking #7276"
          action={
            <Button type="button" variant="outline" size="sm">
              <Settings2 className="size-3.5" />
              Change
            </Button>
          }
        />
        <Row
          title="Default income category"
          description="Sales of Product Income"
          action={
            <Button type="button" variant="outline" size="sm">
              <Settings2 className="size-3.5" />
              Change
            </Button>
          }
        />
      </CardSection>

      <CardSection label="Danger zone">
        <Row
          title="Reset all mappings to defaults"
          description="Clears every 'Your field' choice — does not delete transactions"
          action={
            <Button type="button" variant="outline" size="sm">
              Reset mappings
            </Button>
          }
        />
        <Row
          title="Disconnect this account"
          description="Stop the sync and revoke access. Imported transactions stay in QuickBooks."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDisconnectClick}
            >
              <X className="size-3.5" />
              Disconnect
            </Button>
          }
        />
        <Row
          title="Delete integration & all imported records"
          description="Permanently removes this connection AND every transaction it created. Irreversible."
          action={
            <Button type="button" variant="outline" size="sm">
              <Trash2 className="size-3.5" />
              Delete...
            </Button>
          }
        />
      </CardSection>
    </div>
  )
}
