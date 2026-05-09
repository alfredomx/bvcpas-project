'use client'

import { useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronsLeft, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useClients } from '@/modules/11-clients/hooks/use-clients'

import { useSidebarCollapsed } from '../hooks/use-sidebar-collapsed'
import { SidebarCollapsed } from './sidebar-collapsed'
import { SidebarRow } from './sidebar-row'

const ROW_HEIGHT = 48
const SKELETON_ROW_COUNT = 7

export function Sidebar() {
  const router = useRouter()
  const params = useParams()
  const activeClientId = typeof params?.clientId === 'string' ? params.clientId : undefined

  const { collapsed, setCollapsed } = useSidebarCollapsed()
  const { items, isLoading } = useClients()
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
    router.push(`/dashboard/clients/${clientId}/uncategorized-transactions`)
  }

  if (collapsed) {
    return <SidebarCollapsed onExpand={() => setCollapsed(false)} />
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r">
      <div className="flex h-10 items-center gap-2 border-b px-3">
        <span className="text-sm font-medium">All</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft />
        </Button>
      </div>

      <div className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div data-testid="sidebar-skeleton" className="flex flex-col gap-1.5 p-2">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
                  key={item.id}
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
                    clientId={item.id}
                    legalName={item.legal_name}
                    active={item.id === activeClientId}
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
