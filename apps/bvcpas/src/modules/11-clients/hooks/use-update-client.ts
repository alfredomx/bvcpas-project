'use client'

// Mutation que dispara `PATCH /v1/clients/:id`.
// onSuccess: invalida `['uncats-detail', clientId, ...]` (header,
// stats, leyenda del filter se refrescan) y `['clients']` (sidebar
// puede cambiar nombre).

import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  updateClient,
  type ClientDetail,
  type UpdateClientBody,
} from '../api/clients.api'

export function useUpdateClient(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation<ClientDetail, Error, UpdateClientBody>({
    mutationFn: (body) => updateClient(clientId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uncats-detail', clientId] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
