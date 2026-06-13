'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { deleteBankPortal } from '../api/bank-accounts.api'
import { BANK_PORTALS_QUERY_KEY } from './use-bank-portals'

export function useDeleteBankPortal() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (portalId) => deleteBankPortal(portalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_PORTALS_QUERY_KEY] })
      toast.success('Portal deleted')
    },
    onError: () => {
      toast.error('Could not delete portal (it may be in use by a login)')
    },
  })
}
