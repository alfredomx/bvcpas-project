'use client'

// Hook que entrega el dashboard de integraciones de un cliente.
// Llama `GET /v1/clients/:id/integrations` vía SDK tipado.
//
// Expone { data, isLoading, isError, error, refetch } (passthrough
// de useQuery). Loading/empty/error states los maneja la pantalla.

import { useQuery } from '@tanstack/react-query'

import {
  getClientIntegrations,
  type IntegrationsDashboard,
} from '../api/integrations.api'

export const INTEGRATIONS_QUERY_KEY = 'client-integrations'

export function useClientIntegrations(clientId: string) {
  return useQuery<IntegrationsDashboard, Error>({
    queryKey: [INTEGRATIONS_QUERY_KEY, clientId],
    queryFn: () => getClientIntegrations(clientId),
    enabled: Boolean(clientId),
  })
}
