'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createBankPortal,
  type BankPortalDetail,
  type CreateBankPortalBody,
} from '../api/bank-accounts.api'
import { BANK_PORTALS_QUERY_KEY } from './use-bank-portals'

export function useCreateBankPortal() {
  const queryClient = useQueryClient()

  return useMutation<BankPortalDetail, Error, CreateBankPortalBody>({
    mutationFn: (body) => createBankPortal(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_PORTALS_QUERY_KEY] })
      toast.success('Portal added')
    },
    onError: () => {
      toast.error('Could not add portal')
    },
  })
}
