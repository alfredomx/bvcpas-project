'use client'

// Header del cliente en la tab Uncat. Transactions.
//
// Muestra: tier badge + followup badge + legal_name + contact + last
// notified. En top-right hay un botón ⚙ Configure que abre el
// `<CsConfigSheet>` con los settings del envío de follow-ups
// (D-bvcpas-036).

import { useState } from 'react'
import { Settings } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatFollowupStatus } from '../lib/format'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

import { CsConfigSheet } from './cs-config-sheet'

export interface CsHeaderProps {
  client: UncatsDetailResponse['client']
  followup: UncatsDetailResponse['followup']
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const yy = String(d.getUTCFullYear()).slice(-2)
  return `${mm}-${dd}-${yy}`
}

export function CsHeader({ client, followup }: CsHeaderProps) {
  const [configOpen, setConfigOpen] = useState(false)

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {client.tier === 'platinum' || client.tier === 'gold' ? (
            <Badge variant="secondary">★ {client.tier.toUpperCase()}</Badge>
          ) : (
            <Badge variant="outline">{client.tier.toUpperCase()}</Badge>
          )}
          <Badge variant="outline">{formatFollowupStatus(followup.status)}</Badge>
        </div>
        <h1 className="text-2xl font-semibold">{client.legal_name}</h1>
        <p className="text-sm text-muted-foreground">
          contact · {client.primary_contact_name ?? '—'} · last notified{' '}
          {formatDateShort(followup.sent_at)}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfigOpen(true)}
        aria-label="Configure"
      >
        <Settings />
        Configure
      </Button>

      <CsConfigSheet open={configOpen} onOpenChange={setConfigOpen} client={client} />
    </div>
  )
}
