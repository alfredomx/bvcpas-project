'use client'

import { cn } from '@/lib/utils'

export interface SidebarRowProps {
  clientId: string
  legalName: string
  active?: boolean
  onSelect: (clientId: string) => void
}

export function SidebarRow({ clientId, legalName, active = false, onSelect }: SidebarRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(clientId)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-full w-full items-center border-b px-3 text-left text-sm transition-colors',
        active ? 'bg-muted font-medium' : 'hover:bg-muted/50',
      )}
    >
      <span className="truncate">{legalName}</span>
    </button>
  )
}
