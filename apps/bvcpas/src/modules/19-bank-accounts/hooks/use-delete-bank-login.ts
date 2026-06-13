'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { deleteBankLogin } from '../api/bank-accounts.api'
import { BANK_LOGINS_QUERY_KEY } from './use-bank-logins'

export function useDeleteBankLogin() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (credentialId) => deleteBankLogin(credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_LOGINS_QUERY_KEY] })
      toast.success('Bank login deleted')
    },
    onError: () => {
      toast.error('Could not delete bank login')
    },
  })
}
