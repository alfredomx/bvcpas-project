'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  updateBankLogin,
  type BankLoginDetail,
  type UpdateBankLoginBody,
} from '../api/bank-accounts.api'
import { BANK_LOGIN_QUERY_KEY } from './use-bank-login'
import { BANK_LOGINS_QUERY_KEY } from './use-bank-logins'

export interface UpdateBankLoginVars {
  credentialId: string
  body: UpdateBankLoginBody
}

export function useUpdateBankLogin() {
  const queryClient = useQueryClient()

  return useMutation<BankLoginDetail, Error, UpdateBankLoginVars>({
    mutationFn: ({ credentialId, body }) => updateBankLogin(credentialId, body),
    onSuccess: (_, { credentialId }) => {
      queryClient.invalidateQueries({ queryKey: [BANK_LOGINS_QUERY_KEY] })
      queryClient.invalidateQueries({
        queryKey: [BANK_LOGIN_QUERY_KEY, credentialId],
      })
      toast.success('Bank login updated')
    },
    onError: () => {
      toast.error('Could not update bank login')
    },
  })
}
