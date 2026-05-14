'use client'

// Botones de quick links. "Sheet" sigue siendo placeholder (toast
// "coming soon"); "Follow-up email" abre `<DraftFollowupDialog>` y
// "Log a call" abre `<CallLogDialog>`.

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

import { CallLogDialog } from './call-log-dialog'
import { DraftFollowupDialog } from './draft-followup-dialog'

export interface CsQuickLinksProps {
  client: UncatsDetailResponse['client']
  publicLink: UncatsDetailResponse['public_link']
}

export function CsQuickLinks({ client, publicLink }: CsQuickLinksProps) {
  const [draftOpen, setDraftOpen] = useState(false)
  const [callLogOpen, setCallLogOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick links</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => toast.message('Sheet coming soon.')}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCallLogOpen(true)}
        >
          Log a call
        </Button>
      </div>

      <DraftFollowupDialog
        open={draftOpen}
        onOpenChange={setDraftOpen}
        client={client}
        publicLink={publicLink}
      />

      <CallLogDialog
        open={callLogOpen}
        onOpenChange={setCallLogOpen}
        clientId={client.id}
      />
    </div>
  )
}
