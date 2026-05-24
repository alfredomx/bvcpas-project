// Mapeo del status del backend (healthy | needs_reauth | paused) a
// labels visibles en la UI. Los labels son neutros (sin colores
// semánticos) por decisión de diseño v0.1.0.

import type { IntegrationStatus } from '../api/integrations.api'

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  healthy: 'Connected',
  needs_reauth: 'Re-auth needed',
  paused: 'Paused',
}

/**
 * Deriva las iniciales del avatar a partir del providerLabel.
 * Toma las primeras 2 letras en mayúsculas. Si el label tiene
 * múltiples palabras, toma la primera letra de las primeras 2.
 */
export function deriveInitials(providerLabel: string): string {
  const words = providerLabel.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return providerLabel.slice(0, 2).toUpperCase()
}
