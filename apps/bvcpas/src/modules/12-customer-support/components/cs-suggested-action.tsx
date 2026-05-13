'use client'

// Card "Suggested next action". Muestra mensaje basado en followup
// status + silent streak. CTA "Draft follow-up" abre `<DraftFollowupDialog>`.

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

import { DraftFollowupDialog } from './draft-followup-dialog'

export interface CsSuggestedActionProps {
  client: UncatsDetailResponse['client']
  followup: UncatsDetailResponse['followup']
  stats: UncatsDetailResponse['stats']
  publicLink: UncatsDetailResponse['public_link']
}

function buildMessage(
  client: UncatsDetailResponse['client'],
  followup: UncatsDetailResponse['followup'],
  stats: UncatsDetailResponse['stats'],
): string {
  const contact = client.primary_contact_name ?? 'this client'
  const days = Math.max(0, Math.floor(stats.silent_streak_days))
  if (followup.status === 'awaiting_reply' && days > 0) {
    return `No reply from ${contact} in ${days} day${days === 1 ? '' : 's'}. Consider escalating to phone or via the account owner.`
  }
  if (followup.status === 'pending') {
    return `Send the first follow-up to ${contact} to start the period.`
  }
  return `Review the latest activity for ${contact}.`
}

export function CsSuggestedAction({
  client,
  followup,
  stats,
  publicLink,
}: CsSuggestedActionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Suggested next action
            </p>
            <p className="text-sm font-medium">Send follow-up email</p>
            <p className="text-sm text-muted-foreground">
              {buildMessage(client, followup, stats)}
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>Draft follow-up →</Button>
        </CardContent>
      </Card>

      <DraftFollowupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={client}
        publicLink={publicLink}
      />
    </>
  )
}
