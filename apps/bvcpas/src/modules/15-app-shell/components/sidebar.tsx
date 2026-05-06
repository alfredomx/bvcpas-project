'use client'

// <Sidebar>: lista virtualizada de clientes con search local y filtro
// "All" (único filtro en v0.3.0). Consume useClientsList() y navega
// con next/navigation.
//
// Virtualización (D-bvcpas-016): @tanstack/react-virtual desde día 1
// aunque haya <100 clientes, para evitar refactor cuando crezca.

import { useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronsLeft, Search } from 'lucide-react'

import { useClientsList } from '@/modules/13-dashboards/hooks/use-clients-list'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useSidebarCollapsed } from '../hooks/use-sidebar-collapsed'
import { SidebarCollapsed } from './sidebar-collapsed'
import { SidebarRow } from './sidebar-row'

const ROW_HEIGHT = 36
const SKELETON_ROW_COUNT = 8

export function Sidebar() {
  const router = useRouter()
  const params = useParams()
  const activeClientId = typeof params?.clientId === 'string' ? params.clientId : undefined

  const { collapsed, setCollapsed } = useSidebarCollapsed()
  const { items, isLoading } = useClientsList()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.legal_name.toLowerCase().includes(q))
  }, [items, search])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  const handleSelect = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}/customer-support`)
  }

  if (collapsed) {
    return <SidebarCollapsed onExpand={() => setCollapsed(false)} />
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border-default bg-surface-soft">
      {/* Header con search + filtro All + collapse */}
      <div className="flex flex-col gap-2 border-b border-border-default p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className={cn(
                'h-9 w-full rounded-md border border-border-default bg-surface-canvas pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary',
                'outline-none transition focus:border-brand-navy-soft focus:shadow-[0_0_0_3px_rgba(30,42,82,0.10)]',
              )}
            />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors',
              'hover:bg-surface-hover hover:text-brand-navy',
            )}
          >
            <ChevronsLeft className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          <span className="rounded-full bg-brand-navy px-2 py-0.5 text-text-inverse">All</span>
        </div>
      </div>

      {/* Lista virtualizada */}
      {isLoading ? (
        <div data-testid="sidebar-skeleton" className="flex flex-col gap-1 p-3">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((vRow) => {
              const item = filtered[vRow.index]
              return (
                <div
                  key={item.client_id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: ROW_HEIGHT,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  <SidebarRow
                    clientId={item.client_id}
                    legalName={item.legal_name}
                    active={item.client_id === activeClientId}
                    onSelect={handleSelect}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
