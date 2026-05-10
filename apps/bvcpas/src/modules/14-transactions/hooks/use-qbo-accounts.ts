'use client'

// Carga las cuentas QBO vía proxy Intuit. Solo dispara si hay realmId.
// Cache TanStack Query evita recargar entre transacciones del mismo cliente.

import { useQuery } from '@tanstack/react-query'

import { getQboAccounts, type QboAccount } from '../api/qbo-accounts.api'

interface UseQboAccountsReturn {
  accounts: QboAccount[]
  isLoading: boolean
  isError: boolean
}

export function useQboAccounts(realmId: string | null): UseQboAccountsReturn {
  const query = useQuery({
    queryKey: ['qbo-accounts', realmId],
    queryFn: () => getQboAccounts(realmId!),
    enabled: !!realmId,
  })

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
