'use client'

import { usePathname, useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

import { TABS } from '../lib/tabs'
import { setLastTab } from '../hooks/use-last-tab'

export interface ClientTabsProps {
  clientId: string
}

function getActiveSlug(pathname: string | null): string | null {
  if (!pathname) return null
  const segments = pathname.split('/').filter(Boolean)
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
              '-mb-px h-10 border-b-2 px-3 text-sm transition-colors',
              active
                ? 'border-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
