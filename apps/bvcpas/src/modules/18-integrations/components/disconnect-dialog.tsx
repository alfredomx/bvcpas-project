'use client'

import { toast } from 'sonner'

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

export interface DisconnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionTitle: string
}

export function DisconnectDialog({
  open,
  onOpenChange,
  connectionTitle,
}: DisconnectDialogProps) {
  const handleConfirm = () => {
    toast.message(`${connectionTitle} disconnected.`)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect this integration?</AlertDialogTitle>
          <AlertDialogDescription>
            The sync will stop and access will be revoked. Imported transactions
            stay in QuickBooks.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
