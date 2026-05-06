// API wrapper de los endpoints `/v1/dashboards/customer-support` de mapi.
//
// Solo wrappers tipados — sin lógica de fechas, sin sort, sin
// transformaciones. El cálculo del rango (`from`/`to`) y el ordenamiento
// por urgencia viven en el hook `useClientsList()` (Bloque 3b).
//
// Naming snake_case 1:1 con el response del backend (D-bvcpas-020).

import { httpGet } from '@/lib/http'
import type { CustomerSupportListResponse } from '../types'

export interface DashboardRangeParams {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
}

/**
 * Lista maestra del dashboard customer-support: todos los clientes
 * activos con sus stats agregados (uncats, amas, monthly histogram,
 * followup status).
 *
 * Endpoint: `GET /v1/dashboards/customer-support?from=&to=`.
 */
export function listClientsForSidebar(
  params: DashboardRangeParams,
): Promise<CustomerSupportListResponse> {
  const search = new URLSearchParams({ from: params.from, to: params.to })
  return httpGet<CustomerSupportListResponse>(
    `/v1/dashboards/customer-support?${search.toString()}`,
  )
}
