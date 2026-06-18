import type { BankAdapter } from './bank-adapter.base'
import type { BankFetchExecutor } from './bank-fetch.types'
import { ChaseAdapter } from './chase.adapter'

/**
 * Registry portal → adapter. El schema NO codifica a qué adapter corresponde
 * cada `bank_portals` (catálogo abierto de ~275 portales); este registry hace el
 * mapeo por NOMBRE del portal (normalizado).
 *
 * Hoy solo Chase está portado. Otros portales (RBFCU, Wells Fargo, Frost, ...)
 * devuelven `null` hasta que su adapter exista → el caller lanza
 * `BankAdapterNotSupportedError`.
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
 * Devuelve el factory del adapter para el portal, o `null` si ninguno cubre ese
 * portal. Match por inclusión del nombre normalizado (ej. "Chase", "Chase Bank",
 * "JPMorgan Chase" → adapter `chase`).
 */
export function getAdapterFactory(portalName: string): AdapterFactory | null {
  const key = normalizePortalName(portalName)
  for (const [registryKey, factory] of Object.entries(REGISTRY)) {
    if (key === registryKey || key.includes(registryKey)) return factory
  }
  return null
}
