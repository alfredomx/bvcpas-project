'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  changeBankAccountStatus,
  type BankAccountDetail,
  type ChangeBankAccountStatusBody,
} from '../api/bank-accounts.api'
import { BANK_LOGIN_ACCOUNTS_QUERY_KEY } from './use-bank-login-accounts'

export interface ChangeBankAccountStatusVars {
  accountId: string
  body: ChangeBankAccountStatusBody
}

export function useChangeBankAccountStatus() {
  const queryClient = useQueryClient()

  return useMutation<BankAccountDetail, Error, ChangeBankAccountStatusVars>({
    mutationFn: ({ accountId, body }) => changeBankAccountStatus(accountId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [BANK_LOGIN_ACCOUNTS_QUERY_KEY],
      })
      toast.success('Account status changed')
    },
    onError: () => {
      toast.error('Could not change status')
    },
  })
}
