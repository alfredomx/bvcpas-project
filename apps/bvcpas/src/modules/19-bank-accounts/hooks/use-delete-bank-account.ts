'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { deleteBankAccount } from '../api/bank-accounts.api'
import { BANK_LOGIN_ACCOUNTS_QUERY_KEY } from './use-bank-login-accounts'

export function useDeleteBankAccount() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (accountId) => deleteBankAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [BANK_LOGIN_ACCOUNTS_QUERY_KEY],
      })
      toast.success('Account deleted')
    },
    onError: () => {
      toast.error('Could not delete account')
    },
  })
}
