// Wrapper sobre `GET /v1/clients/:id/uncats?from=&to=`.
//
// View del dashboard de Customer Support (D-bvcpas-030). Cruza
// clients + followups + monthly aggregation. Vive en 13-dashboards
// (D-bvcpas-026).

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type UncatsDetailResponse = components['schemas']['CustomerSupportDetailResponseDto']

export interface UncatsDetailParams {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
}

export async function getUncatsDetail(
  clientId: string,
  { from, to }: UncatsDetailParams,
): Promise<UncatsDetailResponse> {
  const { data, error } = await api.GET('/v1/clients/{id}/uncats', {
    params: {
      path: { id: clientId },
      query: { from, to },
    },
  })
  if (error) throw error
  if (!data) throw new Error('getUncatsDetail: empty response')
  return data
}
