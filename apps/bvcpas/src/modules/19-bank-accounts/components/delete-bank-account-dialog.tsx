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

import type { BankAccount } from '../api/bank-accounts.api'
import { useDeleteBankAccount } from '../hooks/use-delete-bank-account'

export interface DeleteBankAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: BankAccount | null
}

export function DeleteBankAccountDialog({
  open,
  onOpenChange,
  account,
}: DeleteBankAccountDialogProps) {
  const deleteMutation = useDeleteBankAccount()

  const handleConfirm = () => {
    if (!account) return
    deleteMutation.mutate(account.id, {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete account?</AlertDialogTitle>
          <AlertDialogDescription>
            {account
              ? `This removes the account ····${account.account_mask} from this login.`
              : 'This removes the account from this login.'}{' '}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
