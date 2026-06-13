'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  updateBankPortal,
  type BankPortalDetail,
  type UpdateBankPortalBody,
} from '../api/bank-accounts.api'
import { BANK_PORTALS_QUERY_KEY } from './use-bank-portals'

export interface UpdateBankPortalVars {
  portalId: string
  body: UpdateBankPortalBody
}

export function useUpdateBankPortal() {
  const queryClient = useQueryClient()

  return useMutation<BankPortalDetail, Error, UpdateBankPortalVars>({
    mutationFn: ({ portalId, body }) => updateBankPortal(portalId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_PORTALS_QUERY_KEY] })
      toast.success('Portal updated')
    },
    onError: () => {
      toast.error('Could not update portal')
    },
  })
}
