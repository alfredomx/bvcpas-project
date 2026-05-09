'use client'

// Mutation que dispara `POST /v1/clients/:id/transactions/sync`.
// Al éxito: invalida `['transactions', clientId, ...]` y
// `['uncats-detail', clientId, ...]` para que la tabla y el header/
// stats/timeline se refetcheen automáticamente.

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { syncTransactions, type SyncBody, type SyncResult } from '../api/transactions.api'

export function useSyncTransactions(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation<SyncResult, Error, SyncBody>({
    mutationFn: (body) => syncTransactions(clientId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', clientId] })
      queryClient.invalidateQueries({ queryKey: ['uncats-detail', clientId] })
    },
  })
}
