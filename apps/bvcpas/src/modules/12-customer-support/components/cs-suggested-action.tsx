// Card "Suggested next action". Muestra mensaje basado en followup
// status + silent streak. CTA "Draft follow-up" → toast (placeholder).

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { silentStreakInMonths } from '../lib/format'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

export interface CsSuggestedActionProps {
  client: UncatsDetailResponse['client']
  followup: UncatsDetailResponse['followup']
  stats: UncatsDetailResponse['stats']
}

function buildMessage(
  client: UncatsDetailResponse['client'],
  followup: UncatsDetailResponse['followup'],
  stats: UncatsDetailResponse['stats'],
): string {
  const contact = client.primary_contact_name ?? 'this client'
  const months = silentStreakInMonths(stats.silent_streak_days)
  if (followup.status === 'awaiting_reply' && months > 0) {
    return `No reply from ${contact} in ${months} month${months === 1 ? '' : 's'}. Consider escalating to phone or via the account owner.`
  }
  if (followup.status === 'pending') {
    return `Send the first follow-up to ${contact} to start the period.`
  }
  return `Review the latest activity for ${contact}.`
}

export function CsSuggestedAction({ client, followup, stats }: CsSuggestedActionProps) {
  const handleClick = () => {
    toast.message('Draft follow-up coming soon.')
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Suggested next action
          </p>
          <p className="text-sm font-medium">Send follow-up email</p>
          <p className="text-sm text-muted-foreground">{buildMessage(client, followup, stats)}</p>
        </div>
        <Button onClick={handleClick}>Draft follow-up →</Button>
      </CardContent>
    </Card>
  )
}
