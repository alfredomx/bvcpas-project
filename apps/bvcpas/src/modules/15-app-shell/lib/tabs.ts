// Single source of truth de los tabs por cliente.
//
// El orden visual del array es el orden en que aparecen en la barra
// horizontal. El `slug` es el segmento de URL
// (`/dashboard/clients/<clientId>/<slug>`) y debe coincidir con el
// nombre de la carpeta en `src/app/(authenticated)/dashboard/clients/[clientId]/`.
//
// El tab `home` es especial: apunta a la raíz `/dashboard/clients/<id>`
// (sin sub-slug). En la detección de active, el pathname exacto a la
// raíz marca a `home` como activo.
//
// `badge` es opcional; hoy va hardcoded para v0.9.0 (visual). Cuando
// existan los hooks que cuenten reales, este número se reemplaza por
// data dinámica.

export interface TabDef {
  /** Segmento de URL. Coincide con la carpeta de Next. Para `home` es '' (raíz). */
  slug: string
  /** Texto que se muestra en la barra de tabs. */
  label: string
  /** Contador opcional al lado del label. */
  badge?: number
}

export const TABS: readonly TabDef[] = [
  { slug: 'home', label: 'Home' },
  { slug: 'uncategorized-transactions', label: 'Uncat. Transactions', badge: 6 },
  { slug: 'reconciliations', label: 'Reconciliations', badge: 2 },
  { slug: 'w9', label: 'W-9', badge: 3 },
  { slug: '1099', label: '1099' },
  { slug: 'mgt-report', label: 'Mgt Report' },
  { slug: 'tax-packet', label: 'Tax Packet' },
  { slug: 'qtr-payroll', label: 'QTR Payroll', badge: 1 },
  { slug: 'property-tax', label: 'Property Tax' },
] as const

/** Slug por default cuando un cliente se abre sin tab específico. */
export const DEFAULT_TAB_SLUG: TabDef['slug'] = 'home'

/**
 * Retorna el `TabDef` para un slug dado, o `undefined` si el slug no
 * existe en la lista.
 */
export function findTabBySlug(slug: string): TabDef | undefined {
  return TABS.find((t) => t.slug === slug)
}
