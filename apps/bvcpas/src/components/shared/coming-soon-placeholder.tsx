// Placeholder amable para pantallas no implementadas todavía. Se usa
// en las 8 tabs del cliente en v0.3.0; cuando un módulo entre con
// pantalla real, se reemplaza importación por la pantalla concreta.

import { Construction } from 'lucide-react'

export interface ComingSoonPlaceholderProps {
  tab: string
}

export function ComingSoonPlaceholder({ tab }: ComingSoonPlaceholderProps) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-lavender">
        <Construction className="size-6 text-brand-navy-soft" aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-navy-soft">
          Coming soon
        </p>
        <h2 className="text-[22px] font-bold tracking-tight text-brand-navy">{tab}</h2>
      </div>
      <p className="max-w-sm text-[13px] leading-relaxed text-text-muted">
        This tab will be available in a future release. Once the data is ready, this placeholder
        will be replaced with the real screen.
      </p>
    </section>
  )
}
