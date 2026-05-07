'use client'

// /dashboard sin clientId. Empty state que invita a seleccionar un
// cliente desde la sidebar (D-bvcpas-017: sin auto-select).

import { Users } from 'lucide-react'

export default function DashboardEmptyStatePage() {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-lavender">
        <Users className="size-6 text-brand-navy-soft" aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-navy-soft">
          No client selected
        </p>
        <h2 className="text-[22px] font-bold tracking-tight text-brand-navy">Select a client</h2>
      </div>
      <p className="max-w-sm text-[13px] leading-relaxed text-text-muted">
        Pick a client from the sidebar to see their tabs and details.
      </p>
    </section>
  )
}
