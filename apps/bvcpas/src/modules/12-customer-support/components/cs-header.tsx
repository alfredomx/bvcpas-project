// Header del cliente en la tab Customer Support.
//
// Muestra: tier badge + followup badge + legal_name + contact + last
// notified. Componente presentacional puro (props-only).

import { Badge } from '@/components/ui/badge'
import { formatFollowupStatus } from '../lib/format'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

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
  return (
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
  )
}
