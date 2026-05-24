'use client'

// Contenido del HoverCard que abre cada IconRailItem. Por ahora solo
// muestra el título y una lista plana de strings dummy. Cuando los
// items reales se definan, el shape de `flyout` se extiende sin
// cambiar el contrato del componente.

import type { IconRailItemFlyout } from '../lib/icon-rail-items'

export interface IconRailFlyoutProps {
  flyout: IconRailItemFlyout
}

export function IconRailFlyout({ flyout }: IconRailFlyoutProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {flyout.title}
      </p>
      <ul className="flex flex-col gap-0.5">
        {flyout.items.map((sub) => (
          <li
            key={sub}
            className="cursor-default rounded px-2 py-1 text-sm hover:bg-accent/40"
          >
            {sub}
          </li>
        ))}
      </ul>
    </div>
  )
}
