'use client'

// Hook que entrega la lista de clientes para la sidebar.
//
// Responsabilidades:
// - Calcula from = (currentYear - 1)-01-01 y to = último día del mes
//   anterior a "hoy" (regla del backend `13-dashboards`, ver
//   apps/mapi/roadmap/13-dashboards/v0.6.1.md).
// - Llama al api wrapper listClientsForSidebar.
// - Ordena los items alfabéticamente por legal_name (case-insensitive).
// - Expone { items, isLoading, isError }.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { listClientsForSidebar } from '../api/customer-support.api'
import type { CustomerSupportListItem } from '../types'

interface UseClientsListReturn {
  items: CustomerSupportListItem[]
  isLoading: boolean
  isError: boolean
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Calcula el rango de fechas que el backend `13-dashboards` espera:
 * - from: 1 de enero del año pasado.
 * - to: último día del mes anterior a "hoy".
 *
 * Ejemplo: si hoy es 2026-05-15 → from='2025-01-01', to='2026-04-30'.
 */
function computeRange(now: Date): { from: string; to: string } {
  const fromYear = now.getFullYear() - 1
  const from = `${fromYear}-01-01`

  // Último día del mes anterior = día 0 del mes actual.
  const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const to = `${lastDayPrevMonth.getFullYear()}-${pad2(lastDayPrevMonth.getMonth() + 1)}-${pad2(lastDayPrevMonth.getDate())}`

  return { from, to }
}

function sortByLegalName(items: CustomerSupportListItem[]): CustomerSupportListItem[] {
  return [...items].sort((a, b) =>
    a.legal_name.localeCompare(b.legal_name, undefined, { sensitivity: 'base' }),
  )
}

export function useClientsList(): UseClientsListReturn {
  // Recalculamos el rango cada render para que tests con vi.setSystemTime
  // y casos donde la pestaña queda abierta meses funcionen igual.
  const { from, to } = computeRange(new Date())

  const query = useQuery({
    queryKey: ['clients-list', from, to],
    queryFn: () => listClientsForSidebar({ from, to }),
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
