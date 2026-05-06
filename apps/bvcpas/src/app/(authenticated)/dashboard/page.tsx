'use client'

// /dashboard sin clientId. Empty state que invita a seleccionar un
// cliente desde la sidebar (D-bvcpas-017: sin auto-select).

import { Users } from 'lucide-react'

export default function DashboardEmptyStatePage() {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Users className="size-10 text-text-tertiary" aria-hidden />
      <h2 className="text-lg font-semibold text-brand-navy">Select a client</h2>
      <p className="max-w-sm text-sm text-text-muted">
        Pick a client from the sidebar to see their tabs and details.
      </p>
    </section>
  )
}
