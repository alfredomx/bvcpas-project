'use client'

// Columna izquierda. Tabs To answer / Answered / All + lista plana.
//
// Estabilidad del filtro: cuando el textarea de la derecha tiene el
// foco, congelamos qué transacciones están "visibles" en la tab
// activa. Eso evita que escribir una letra haga desaparecer la
// transacción de "To answer". El padre informa el estado de foco
// vía `isEditing`. Cuando vuelve a false, la lista se recalcula.

import { useEffect, useMemo, useRef, useState } from 'react'

import { Check } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { PublicUncatsResponseItem } from '../api/public-uncats.api'

type TabKey = 'to_answer' | 'answered' | 'all'

export interface PuTransactionsListProps {
  items: PublicUncatsResponseItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  isEditing: boolean
}

function isResponded(item: PublicUncatsResponseItem): boolean {
  return item.response !== null
}

export function PuTransactionsList({
  items,
  selectedId,
  onSelect,
  isEditing,
}: PuTransactionsListProps) {
  const [tab, setTab] = useState<TabKey>('all')

  // Set congelado de ids visibles para evitar que un item desaparezca
  // mientras el cliente escribe. Se actualiza solo cuando isEditing
  // pasa a false.
  const frozenIdsRef = useRef<Set<string> | null>(null)

  const computedIds = useMemo(() => {
    if (tab === 'all') return new Set(items.map((i) => i.id))
    if (tab === 'to_answer')
      return new Set(items.filter((i) => !isResponded(i)).map((i) => i.id))
    return new Set(items.filter((i) => isResponded(i)).map((i) => i.id))
  }, [items, tab])

  useEffect(() => {
    if (!isEditing) frozenIdsRef.current = null
  }, [isEditing, tab])

  const visibleIds = isEditing
    ? (frozenIdsRef.current ??
      // Capturamos el set actual la primera vez que entramos a edit.
      (frozenIdsRef.current = new Set([
        ...computedIds,
        ...(selectedId ? [selectedId] : []),
      ])))
    : computedIds

  const visibleItems = items.filter((i) => visibleIds.has(i.id))

  const counts = useMemo(() => {
    const responded = items.filter(isResponded).length
    return {
      to_answer: items.length - responded,
      answered: responded,
      all: items.length,
    }
  }, [items])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="to_answer">
              To answer ({counts.to_answer})
            </TabsTrigger>
            <TabsTrigger value="answered">
              Answered ({counts.answered})
            </TabsTrigger>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {visibleItems.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No transactions in this tab.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const selected = item.id === selectedId
            const responded = isResponded(item)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-200 px-3 py-2 text-left transition-colors ${
                    selected ? 'bg-accent' : 'hover:bg-accent/40'
                  }`}
                >
                  <div className="size-3.5 shrink-0">
                    {responded && (
                      <Check
                        className="size-3.5 text-green-600"
                        aria-label="answered"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {item.vendor_name ?? '—'}
                      </span>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          item.category === 'uncategorized_income'
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}
                      >
                        {item.category === 'uncategorized_income' ? '+' : ''}$
                        {item.amount}
                      </span>
                    </div>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {item.txn_date} ·{' '}
                      {item.category === 'uncategorized_income' ? 'income' : 'expense'}
                      {item.memo ? ` · ${item.memo}` : ''}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
