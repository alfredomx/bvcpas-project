'use client'

// Barra horizontal con los 8 tabs del cliente. Click navega + guarda
// la tab seleccionada como "última" para ese clientId.
//
// Diseño 1:1 con reference/cs-navy2.css (.st-tab): texto secundario
// con peso 500, activa en navy con underline naranja 2.5px.

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
    <div
      role="tablist"
      className="flex items-end gap-0.5 border-b border-border-default bg-surface-soft px-4"
    >
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
              // h-10.75 (43px) = altura final del bar. El -mb-px mete el
              // button 1px sobre el border-b del contenedor, así el
              // border no suma a la altura total. Resultado: 43px
              // alineado con el header de la sidebar.
              // font-size 11.5px = match con .st-tab del prototipo.
              'relative -mb-px h-10.75 border-b-[2.5px] px-3.5 text-[11.5px] font-medium transition-colors',
              active
                ? 'border-brand-accent text-brand-navy'
                : 'border-transparent text-text-muted hover:text-brand-navy',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
