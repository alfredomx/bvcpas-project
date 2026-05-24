'use client'

// Mutation que dispara `POST /v1/connections/:id/resume`.
// onSuccess: invalida el query del dashboard del cliente.
// onError: toast.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { resumeConnection } from '../api/integrations.api'
import { INTEGRATIONS_QUERY_KEY } from './use-client-integrations'

export function useResumeConnection() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (id) => resumeConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATIONS_QUERY_KEY] })
      toast.success('Connection resumed')
    },
    onError: () => {
      toast.error('Could not resume connection')
    },
  })
}
