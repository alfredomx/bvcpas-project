import type { BankAdapter } from './bank-adapter.base'
import type { BankFetchExecutor } from './bank-fetch.types'
import { ChaseAdapter } from './chase.adapter'

/**
 * Registry portal → adapter (v0.21.0).
 *
 * El schema NO codifica a qué adapter corresponde cada `bank_portals` (decisión
 * D-mapi-BW-003: catálogo abierto de ~275 portales, los adapters conocen
 * internamente su portal). Este registry hace ese mapeo por NOMBRE del portal
 * (normalizado): el step-flow de descarga resuelve `portal.name` → factory del
 * adapter.
 *
 * Hoy solo Chase está portado a Design B (v0.18.0). Otros portales (RBFCU, Wells
 * Fargo, Frost, ...) devuelven `null` hasta que su adapter exista → el caller
 * lanza `BankAdapterNotSupportedError`.
 */

type AdapterFactory = (exec: BankFetchExecutor) => BankAdapter

/** Clave = substring que debe contener el nombre del portal (en minúsculas). */
const REGISTRY: Record<string, AdapterFactory> = {
  chase: (exec) => new ChaseAdapter(exec),
}

export function normalizePortalName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Devuelve el factory del adapter para el portal, o `null` si ningún adapter
 * cubre ese portal. Match por inclusión del nombre normalizado (ej. "Chase",
 * "Chase Bank", "JPMorgan Chase" → adapter `chase`).
 */
export function getAdapterFactory(portalName: string): AdapterFactory | null {
  const key = normalizePortalName(portalName)
  for (const [registryKey, factory] of Object.entries(REGISTRY)) {
    if (key === registryKey || key.includes(registryKey)) return factory
  }
  return null
}
