'use client'

// Hook que llama `GET /v1/clients/:id/transactions?category=...`.

import { useQuery } from '@tanstack/react-query'

import {
  listTransactions,
  type Transaction,
  type TransactionCategory,
} from '../api/transactions.api'

interface UseTransactionsReturn {
  items: Transaction[]
  isLoading: boolean
  isError: boolean
}

export function useTransactions(
  clientId: string,
  category: TransactionCategory,
): UseTransactionsReturn {
  const query = useQuery({
    queryKey: ['transactions', clientId, category],
    queryFn: () => listTransactions(clientId, { category }),
  })

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
