'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  updateBankAccount,
  type BankAccountDetail,
  type UpdateBankAccountBody,
} from '../api/bank-accounts.api'
import { BANK_LOGIN_ACCOUNTS_QUERY_KEY } from './use-bank-login-accounts'

export interface UpdateBankAccountVars {
  accountId: string
  body: UpdateBankAccountBody
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient()

  return useMutation<BankAccountDetail, Error, UpdateBankAccountVars>({
    mutationFn: ({ accountId, body }) => updateBankAccount(accountId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [BANK_LOGIN_ACCOUNTS_QUERY_KEY],
      })
      toast.success('Account updated')
    },
    onError: () => {
      toast.error('Could not update account')
    },
  })
}
