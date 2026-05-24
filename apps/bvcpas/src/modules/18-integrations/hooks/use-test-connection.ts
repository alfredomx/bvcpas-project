'use client'

// Mutation que dispara `POST /v1/connections/:id/test`.
// Health-check puntual: NO invalida el dashboard (el status no
// cambia en DB por correr un test, solo verifica credenciales en vivo).
// onSuccess: toast con el message del response.

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  testConnection,
  type TestConnectionResponse,
} from '../api/integrations.api'

export function useTestConnection() {
  return useMutation<TestConnectionResponse, Error, string>({
    mutationFn: (id) => testConnection(id),
    onSuccess: (data) => {
      toast.success(data.message ?? 'Connection is healthy')
    },
    onError: () => {
      toast.error('Connection check failed')
    },
  })
}
