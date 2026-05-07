'use client'

// <Sidebar>: lista virtualizada de clientes con search local y filtro
// "All" (único filtro en v0.3.0). Diseño 1:1 con reference/cs-navy2.css
// (.stream-list-pane, .stream-tabs, .stream-search-wrap, .st-tab).
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

// Fila densa: nombre+monto / status+contacto / sparkline. Match 1:1
// con reference (.sr-body 64.89px medido en DevTools del prototipo).
const ROW_HEIGHT = 65
const SKELETON_ROW_COUNT = 7

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
    <aside className="flex h-full w-103 flex-col border-r border-border-default bg-surface-canvas">
      {/* Stream tabs (filtros). Hoy solo "All" — espejo de .stream-tabs. */}
      <div className="flex items-center gap-2 border-b border-border-default bg-surface-soft px-3.5 pt-2.5">
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 border-b-[2.5px] border-brand-accent pb-2 text-[11.5px] font-medium text-brand-navy"
        >
          All
          <span className="rounded-full bg-brand-accent/20 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-brand-accent-strong">
            {items.length}
          </span>
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          className={cn(
            'mb-1 flex size-7 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors',
            'hover:bg-surface-muted hover:text-brand-navy',
          )}
        >
          <ChevronsLeft className="size-4" />
        </button>
      </div>

      {/* Search wrap — espejo de .stream-search-wrap */}
      <div className="border-b border-border-soft bg-surface-canvas p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className={cn(
              'h-8 w-full rounded-md border border-border-strong bg-surface-soft pl-8 pr-3 text-[11.5px] text-text-primary placeholder:text-text-tertiary',
              'outline-none transition focus:border-brand-navy-soft focus:bg-surface-canvas focus:shadow-[0_0_0_3px_rgba(30,42,82,0.10)]',
            )}
          />
        </div>
      </div>

      {/* Lista virtualizada */}
      {isLoading ? (
        <div data-testid="sidebar-skeleton" className="flex flex-col gap-1.5 p-3">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface-canvas">
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
