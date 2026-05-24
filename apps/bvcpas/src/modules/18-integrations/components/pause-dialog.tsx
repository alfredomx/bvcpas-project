'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { usePauseConnection } from '../hooks/use-pause-connection'

export interface PauseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string | null
  connectionTitle: string
}

export function PauseDialog({
  open,
  onOpenChange,
  connectionId,
  connectionTitle,
}: PauseDialogProps) {
  const pauseMutation = usePauseConnection()

  const handleConfirm = () => {
    if (!connectionId) return
    pauseMutation.mutate(
      { id: connectionId },
      {
        onSuccess: () => onOpenChange(false),
      },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Pause {connectionTitle || 'this integration'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Sync will stop until you resume it. Imported transactions stay in
            QuickBooks. You can resume any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pauseMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pauseMutation.isPending}
          >
            {pauseMutation.isPending ? 'Pausing…' : 'Pause'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
