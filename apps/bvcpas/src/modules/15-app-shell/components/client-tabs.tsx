'use client'

// Barra horizontal con los 8 tabs del cliente. Click navega + guarda
// la tab seleccionada como "última" para ese clientId.
//
// Detecta tab activa por el último segmento del pathname.

import { usePathname, useRouter } from 'next/navigation'

import { TABS } from '../lib/tabs'
import { setLastTab } from '../hooks/use-last-tab'
import { cn } from '@/lib/utils'

export interface ClientTabsProps {
  clientId: string
}

function getActiveSlug(pathname: string | null): string | null {
  if (!pathname) return null
  const segments = pathname.split('/').filter(Boolean)
  // pathname esperado: /dashboard/clients/<clientId>/<slug>
  return segments[3] ?? null
}

export function ClientTabs({ clientId }: ClientTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const activeSlug = getActiveSlug(pathname)

  const handleClick = (slug: string) => {
    setLastTab(clientId, slug)
    router.push(`/dashboard/clients/${clientId}/${slug}`)
  }

  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-border-default px-4">
      {TABS.map((tab) => {
        const active = tab.slug === activeSlug
        return (
          <button
            key={tab.slug}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleClick(tab.slug)}
            className={cn(
              'relative h-10 px-3 text-sm font-medium transition-colors',
              active ? 'text-brand-navy' : 'text-text-muted hover:text-brand-navy',
            )}
          >
            {tab.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-accent"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
