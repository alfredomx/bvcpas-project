'use client'

// Fila visual de un cliente en la sidebar. v0.3.0 simplificado: solo
// nombre + estado activo. El resto (heat bar, monto, status, sparkline,
// VIP) entra en versiones futuras cuando el operador defina reglas.

import { cn } from '@/lib/utils'

export interface SidebarRowProps {
  clientId: string
  legalName: string
  /** Cliente actualmente seleccionado en la URL. */
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
        'flex w-full items-center px-3 py-2 text-left text-sm transition-colors',
        'hover:bg-surface-hover',
        active ? 'bg-surface-selected font-semibold text-brand-navy' : 'text-text-secondary',
      )}
    >
      <span className="truncate">{legalName}</span>
    </button>
  )
}
