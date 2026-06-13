'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createBankLogin,
  type BankLoginDetail,
  type CreateBankLoginBody,
} from '../api/bank-accounts.api'
import { BANK_LOGINS_QUERY_KEY } from './use-bank-logins'

export function useCreateBankLogin() {
  const queryClient = useQueryClient()

  return useMutation<BankLoginDetail, Error, CreateBankLoginBody>({
    mutationFn: (body) => createBankLogin(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_LOGINS_QUERY_KEY] })
      toast.success('Bank login created')
    },
    onError: () => {
      toast.error('Could not create bank login')
    },
  })
}
