'use client'

// Mutation que dispara `POST /v1/connections/:id/pause`.
// onSuccess: invalida el query del dashboard del cliente.
// onError: toast.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { pauseConnection } from '../api/integrations.api'
import { INTEGRATIONS_QUERY_KEY } from './use-client-integrations'

export interface PauseConnectionVars {
  id: string
  reason?: string
}

export function usePauseConnection() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, PauseConnectionVars>({
    mutationFn: ({ id, reason }) => pauseConnection(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATIONS_QUERY_KEY] })
      toast.success('Connection paused')
    },
    onError: () => {
      toast.error('Could not pause connection')
    },
  })
}
