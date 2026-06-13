'use client'

import { useQuery } from '@tanstack/react-query'

import { listBankPortals, type BankPortalsListResponse } from '../api/bank-accounts.api'

export const BANK_PORTALS_QUERY_KEY = 'bank-portals'

// El catálogo de portales cambia raramente (280 seedeados).
// staleTime alto para evitar refetch al cambiar de pestaña.
export function useBankPortals() {
  return useQuery<BankPortalsListResponse, Error>({
    queryKey: [BANK_PORTALS_QUERY_KEY],
    queryFn: () => listBankPortals(),
    staleTime: 1000 * 60 * 60, // 1 hora
  })
}
