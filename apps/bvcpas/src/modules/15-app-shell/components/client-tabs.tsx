'use client'

import { usePathname, useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

import { TABS } from '../lib/tabs'
import { setLastTab } from '../hooks/use-last-tab'

export interface ClientTabsProps {
  clientId: string
}

/**
 * Devuelve el slug activo según la URL:
 * - `home` cuando estamos en la raíz `/dashboard/clients/<id>`.
 * - El slug de la sub-ruta en cualquier otro caso.
 */
function getActiveSlug(pathname: string | null): string | null {
  if (!pathname) return null
  const segments = pathname.split('/').filter(Boolean)
  // [dashboard, clients, <id>] → 3 segmentos → home.
  if (segments.length <= 3) return 'home'
  return segments[3] ?? null
}

export function ClientTabs({ clientId }: ClientTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const activeSlug = getActiveSlug(pathname)

  const handleClick = (slug: string) => {
    if (slug === 'home') {
      router.push(`/dashboard/clients/${clientId}`)
      return
    }
    setLastTab(clientId, slug)
    router.push(`/dashboard/clients/${clientId}/${slug}`)
  }

  return (
    <div role="tablist" className="flex items-end gap-1 border-b px-2">
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
              '-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors',
              active
                ? 'border-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full border bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() =>
          router.push(`/dashboard/clients/${clientId}/integrations`)
        }
        className={cn(
          '-mb-px ml-auto flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm transition-colors',
          'text-muted-foreground hover:text-foreground',
        )}
      >
        + Integration
      </button>
    </div>
  )
}
