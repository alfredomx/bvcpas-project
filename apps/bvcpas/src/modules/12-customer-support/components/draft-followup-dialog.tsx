'use client'

// Dialog que muestra el resumen del follow-up email antes de enviarlo:
// destinatario, CC y public link. Bloquea el envío con un aviso si:
//  - el cliente no tiene primary_contact_email,
//  - no hay public link, o
//  - el public link está revocado.
//
// El envío real se conecta en una versión posterior; por ahora "Send"
// solo cierra el dialog. Componente reusable — también se monta desde
// otros puntos (no solo `<CsSuggestedAction>`).

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

import { updateFollowup } from '../api/followups.api'
import { currentPeriod } from '../lib/date-range'

export interface DraftFollowupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: UncatsDetailResponse['client']
  publicLink: UncatsDetailResponse['public_link']
}

interface Blocker {
  message: string
}

function formatTransactionsFilter(
  filter: DraftFollowupDialogProps['client']['transactions_filter'],
): string {
  if (filter === 'all') return 'expense + income'
  if (filter === 'expense') return 'expense only'
  return 'income only'
}

function computeBlockers(
  client: DraftFollowupDialogProps['client'],
  publicLink: DraftFollowupDialogProps['publicLink'],
): Blocker[] {
  const blockers: Blocker[] = []
  if (!client.primary_contact_email) {
    blockers.push({ message: 'No contact email set. Update it in Configure.' })
  }
  if (!publicLink) {
    blockers.push({
      message: 'This client has no public link. Generate one in Configure.',
    })
  } else if (publicLink.revoked_at !== null) {
    blockers.push({
      message: 'Public link is disabled. Enable it in Configure to send.',
    })
  }
  return blockers
}

export function DraftFollowupDialog({
  open,
  onOpenChange,
  client,
  publicLink,
}: DraftFollowupDialogProps) {
  const queryClient = useQueryClient()
  const blockers = computeBlockers(client, publicLink)

  const sendMutation = useMutation({
    mutationFn: () =>
      updateFollowup(client.id, currentPeriod(new Date()), {
        status: 'sent',
        sentAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      // Invalidamos por prefijo: el detail vive bajo
      // ['uncats-detail', clientId, from, to].
      queryClient.invalidateQueries({ queryKey: ['uncats-detail'] })
      toast.success('Follow-up sent.')
      onOpenChange(false)
    },
    onError: () => {
      toast.error('Could not send. Try again.')
    },
  })

  const canSend = blockers.length === 0 && !sendMutation.isPending

  const handleSend = () => {
    sendMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send follow-up email</DialogTitle>
          <DialogDescription>
            Review the details before sending. The email will include the
            public link so the client can review and categorize their uncats.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <Field label="To" value={client.primary_contact_email ?? '—'} />
          <Field label="CC" value={client.cc_email ?? '—'} />
          <Field
            label="Follow-ups send"
            value={formatTransactionsFilter(client.transactions_filter)}
          />
          <Field
            label="Public link"
            value={publicLink?.url ?? '—'}
            mono
          />
        </div>

        {blockers.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <ul className="flex flex-col gap-1 text-xs text-destructive">
              {blockers.map((b, i) => (
                <li key={i}>{b.message}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={!canSend}>
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          mono ? 'break-all font-mono text-xs' : 'text-sm break-all'
        }
      >
        {value}
      </span>
    </div>
  )
}
