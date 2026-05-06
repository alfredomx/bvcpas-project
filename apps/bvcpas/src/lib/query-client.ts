// QueryClient compartido para toda la app (D-bvcpas-014).
//
// Defaults pensados para un dashboard interno donde los datos cambian
// pero no en tiempo real:
// - staleTime 30s: evita refetch agresivo cuando el usuario pasea entre
//   tabs y vuelve.
// - retry 1: si el endpoint falla una vez, intenta de nuevo. Más allá
//   de eso normalmente no es transitorio.
// - refetchOnWindowFocus false: el operador alt-tabs constantemente; no
//   queremos refetch en cada focus.

import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
