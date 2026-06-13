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

import type { BankPortal } from '../api/bank-accounts.api'
import { useDeleteBankPortal } from '../hooks/use-delete-bank-portal'

export interface DeletePortalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portal: BankPortal | null
}

export function DeletePortalDialog({ open, onOpenChange, portal }: DeletePortalDialogProps) {
  const deleteMutation = useDeleteBankPortal()

  const handleConfirm = () => {
    if (!portal) return
    deleteMutation.mutate(portal.id, {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete portal?</AlertDialogTitle>
          <AlertDialogDescription>
            {portal
              ? `This removes "${portal.name}" from the portal catalog. Logins already using it are not allowed to delete it.`
              : 'This removes the portal from the catalog.'}{' '}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete portal'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
