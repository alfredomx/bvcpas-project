'use client'

// Hook que carga la pantalla pública. `retry: false` para que un 404 /
// 410 se propague inmediatamente y el screen pueda manejarlo (redirect
// a /expired o mensaje).

import { useQuery } from '@tanstack/react-query'

import {
  getPublicUncats,
  type PublicUncatsResponse,
} from '../api/public-uncats.api'

export function usePublicUncats(token: string) {
  return useQuery<PublicUncatsResponse>({
    queryKey: ['public-uncats', token],
    queryFn: () => getPublicUncats(token),
    retry: false,
  })
}
