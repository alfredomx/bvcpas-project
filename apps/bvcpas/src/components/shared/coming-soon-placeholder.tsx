// Placeholder amable para pantallas no implementadas todavía. Se usa
// en las 8 tabs del cliente en v0.3.0; cuando un módulo entre con
// pantalla real, se reemplaza importación por la pantalla concreta.

import { Construction } from 'lucide-react'

export interface ComingSoonPlaceholderProps {
  tab: string
}

export function ComingSoonPlaceholder({ tab }: ComingSoonPlaceholderProps) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Construction className="size-10 text-text-tertiary" aria-hidden />
      <h2 className="text-lg font-semibold text-brand-navy">Coming soon</h2>
      <p className="max-w-sm text-sm text-text-muted">
        The <span className="font-semibold text-brand-navy">{tab}</span> tab will be available in a
        future release.
      </p>
    </section>
  )
}
