'use client'

// Versión angosta de la sidebar (~48px). Solo el botón de expandir,
// sin iconos de navegación adicionales (decisión del operador).

import { ChevronsRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SidebarCollapsedProps {
  onExpand: () => void
}

export function SidebarCollapsed({ onExpand }: SidebarCollapsedProps) {
  return (
    <aside className="flex h-full w-12 flex-col items-center border-r border-border-default bg-surface-soft py-3">
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand sidebar"
        className={cn(
          'flex size-8 items-center justify-center rounded text-text-tertiary transition-colors',
          'hover:bg-surface-muted hover:text-brand-navy',
        )}
      >
        <ChevronsRight className="size-4" />
      </button>
    </aside>
  )
}
