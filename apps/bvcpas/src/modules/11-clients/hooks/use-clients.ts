'use client'

// Hook que entrega la lista de clientes desde `GET /v1/clients`.
//
// Responsabilidades:
// - Llama listClients() (SDK tipado).
// - Ordena los items alfabéticamente por legal_name (case-insensitive).
// - Expone { items, isLoading, isError }.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { listClients, type Client } from '../api/clients.api'

// pageSize=200 cubre los casos actuales (dev: 6, prod: 77).
// D-bvcpas-029 — sin paginación real con loop hasta que rebasemos 200.
const SIDEBAR_PAGE_SIZE = 200

interface UseClientsReturn {
  items: Client[]
  isLoading: boolean
  isError: boolean
}

function sortByLegalName(items: Client[]): Client[] {
  return [...items].sort((a, b) =>
    a.legal_name.localeCompare(b.legal_name, undefined, { sensitivity: 'base' }),
  )
}

export function useClients(): UseClientsReturn {
  const query = useQuery({
    queryKey: ['clients', { pageSize: SIDEBAR_PAGE_SIZE }],
    queryFn: () => listClients({ pageSize: SIDEBAR_PAGE_SIZE }),
  })

  const items = useMemo(() => {
    if (!query.data) return []
    return sortByLegalName(query.data.items)
  }, [query.data])

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
