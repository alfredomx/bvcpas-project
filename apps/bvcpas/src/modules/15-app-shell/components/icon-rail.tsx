'use client'

// Barra vertical permanente a la izquierda del shell. Muestra items
// agrupados (top / pinned / bottom). Cada grupo se oculta si está
// vacío para que el rail no muestre separadores huérfanos.

import { ICON_RAIL_ITEMS } from '../lib/icon-rail-items'
import { IconRailItem } from './icon-rail-item'

export function IconRail() {
  const { top, pinned, bottom } = ICON_RAIL_ITEMS

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r bg-background py-3">
      {top.length > 0 && (
        <div className="flex flex-col gap-1 px-1">
          {top.map((item) => (
            <IconRailItem key={item.key} item={item} />
          ))}
        </div>
      )}

      {pinned.length > 0 && (
        <>
          <div className="my-3 px-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pinned
            </p>
          </div>
          <div className="flex flex-col gap-1 px-1">
            {pinned.map((item) => (
              <IconRailItem key={item.key} item={item} />
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      {bottom.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex flex-col gap-1 px-1">
            {bottom.map((item) => (
              <IconRailItem key={item.key} item={item} />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
