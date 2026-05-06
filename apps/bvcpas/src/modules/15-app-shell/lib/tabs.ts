// Single source of truth de los tabs por cliente.
//
// El orden visual del array es el orden en que aparecen en la barra
// horizontal. El `slug` es el segmento de URL
// (`/dashboard/clients/<clientId>/<slug>`) y debe coincidir con el
// nombre de la carpeta en `src/app/(authenticated)/dashboard/clients/[clientId]/`.
//
// Cuando se agregue un tab nuevo: agregar entrada aquí + crear la
// carpeta de Next App Router con el mismo slug.

export interface TabDef {
  /** Segmento de URL. Coincide con la carpeta de Next. */
  slug: string
  /** Texto que se muestra en la barra de tabs. */
  label: string
}

export const TABS: readonly TabDef[] = [
  { slug: 'customer-support', label: 'Customer Support' },
  { slug: 'reconciliations', label: 'Reconciliations' },
  { slug: 'w9', label: 'W-9' },
  { slug: '1099', label: '1099' },
  { slug: 'mgt-report', label: 'Mgt Report' },
  { slug: 'tax-packet', label: 'Tax Packet' },
  { slug: 'qtr-payroll', label: 'QTR Payroll' },
  { slug: 'property-tax', label: 'Property Tax' },
] as const

/** Slug por default cuando un cliente se abre sin tab específico. */
export const DEFAULT_TAB_SLUG: TabDef['slug'] = 'customer-support'

/**
 * Retorna el `TabDef` para un slug dado, o `undefined` si el slug no
 * existe en la lista.
 */
export function findTabBySlug(slug: string): TabDef | undefined {
  return TABS.find((t) => t.slug === slug)
}
