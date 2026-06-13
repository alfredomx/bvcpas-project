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

import type { BankLogin } from '../api/bank-accounts.api'
import { useDeleteBankLogin } from '../hooks/use-delete-bank-login'

export interface DeleteBankLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  login: BankLogin | null
}

export function DeleteBankLoginDialog({
  open,
  onOpenChange,
  login,
}: DeleteBankLoginDialogProps) {
  const deleteMutation = useDeleteBankLogin()

  const handleConfirm = () => {
    if (!login) return
    deleteMutation.mutate(login.id, {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete bank login?</AlertDialogTitle>
          <AlertDialogDescription>
            {login
              ? `This removes ${login.portal.name} credentials for ${login.client.legal_name} and all accounts inside this login.`
              : 'This removes the login and all accounts inside it.'}{' '}
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
            {deleteMutation.isPending ? 'Deleting…' : 'Delete login'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
