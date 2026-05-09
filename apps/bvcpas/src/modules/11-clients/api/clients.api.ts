// Wrapper sobre `GET /v1/clients` usando el SDK tipado.
//
// Primer consumidor del SDK en producción (D-bvcpas-028). El response
// está tipado contra `ClientsListResponseDto` del OpenAPI de mapi via
// `paths` en `@/lib/api/schema`.
//
// Naming snake_case 1:1 con el backend (D-bvcpas-020).

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type ClientsListResponse = components['schemas']['ClientsListResponseDto']
export type Client = ClientsListResponse['items'][number]

export async function listClients(): Promise<ClientsListResponse> {
  const { data, error } = await api.GET('/v1/clients')
  if (error) throw error
  if (!data) throw new Error('listClients: empty response')
  return data
}
