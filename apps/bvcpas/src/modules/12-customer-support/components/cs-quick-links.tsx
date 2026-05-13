'use client'

// Botones de quick links. La mayoría son placeholders (toast
// "Coming soon"); "Follow-up email" abre `<DraftFollowupDialog>`
// — la misma puerta que ofrece `<CsSuggestedAction>`.

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

import { DraftFollowupDialog } from './draft-followup-dialog'

export interface CsQuickLinksProps {
  client: UncatsDetailResponse['client']
  publicLink: UncatsDetailResponse['public_link']
}

const PLACEHOLDER_LINKS = [
  { key: 'sheet', label: 'Sheet' },
  { key: 'email', label: '@ Email thread' },
  { key: 'call', label: 'Call log' },
  { key: 'note', label: 'Add note' },
  { key: 'snooze', label: 'Snooze' },
] as const

export function CsQuickLinks({ client, publicLink }: CsQuickLinksProps) {
  const [draftOpen, setDraftOpen] = useState(false)

  const handleClick = (label: string) => {
    toast.message(`${label} coming soon.`)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick links</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleClick('Sheet')}
        >
          Sheet
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDraftOpen(true)}
        >
          Follow-up email
        </Button>
        {PLACEHOLDER_LINKS.filter((link) => link.key !== 'sheet').map((link) => (
          <Button
            key={link.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClick(link.label)}
          >
            {link.label}
          </Button>
        ))}
      </div>

      <DraftFollowupDialog
        open={draftOpen}
        onOpenChange={setDraftOpen}
        client={client}
        publicLink={publicLink}
      />
    </div>
  )
}
