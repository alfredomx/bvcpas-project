'use client'

import { ChevronsRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface SidebarCollapsedProps {
  onExpand: () => void
}

export function SidebarCollapsed({ onExpand }: SidebarCollapsedProps) {
  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center border-r py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onExpand}
        aria-label="Expand sidebar"
      >
        <ChevronsRight />
      </Button>
    </aside>
  )
}
