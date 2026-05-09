'use client'

// Hook que llama `GET /v1/clients/:id/uncats?from=&to=` calculando el
// rango con la regla del backend (D-bvcpas-031).

import { useQuery } from '@tanstack/react-query'

import { computeRange } from '@/modules/12-customer-support/lib/date-range'

import { getUncatsDetail, type UncatsDetailResponse } from '../api/uncats-detail.api'

interface UseUncatsDetailReturn {
  data: UncatsDetailResponse | undefined
  isLoading: boolean
  isError: boolean
}

export function useUncatsDetail(clientId: string): UseUncatsDetailReturn {
  // Recalculamos el range cada render para que la query siga siendo
  // correcta cuando la pestaña queda abierta meses (cruzar fin de mes
  // dispara nueva queryKey y nuevo fetch).
  const { from, to } = computeRange(new Date())

  const query = useQuery({
    queryKey: ['uncats-detail', clientId, from, to],
    queryFn: () => getUncatsDetail(clientId, { from, to }),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
