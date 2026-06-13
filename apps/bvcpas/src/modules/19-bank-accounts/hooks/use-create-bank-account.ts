'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createBankAccount,
  type BankAccountDetail,
  type CreateBankAccountBody,
} from '../api/bank-accounts.api'
import { BANK_LOGIN_ACCOUNTS_QUERY_KEY } from './use-bank-login-accounts'

export interface CreateBankAccountVars {
  credentialId: string
  body: CreateBankAccountBody
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient()

  return useMutation<BankAccountDetail, Error, CreateBankAccountVars>({
    mutationFn: ({ credentialId, body }) => createBankAccount(credentialId, body),
    onSuccess: (_, { credentialId }) => {
      queryClient.invalidateQueries({
        queryKey: [BANK_LOGIN_ACCOUNTS_QUERY_KEY, credentialId],
      })
      toast.success('Account added')
    },
    onError: () => {
      toast.error('Could not add account')
    },
  })
}
