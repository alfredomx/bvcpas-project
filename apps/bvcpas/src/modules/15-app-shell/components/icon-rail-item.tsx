'use client'

// Item del icon rail. Dos modos:
//
// - `href` definido → renderiza un <Link> que navega. Sin flyout.
//   El estado activo se calcula contra el pathname actual.
// - `flyout` definido → renderiza un botón con HoverCard que abre el
//   panel con sub-items.
//
// Si un item tiene ambos, gana `href` (la nav prevalece sobre el
// flyout). Si no tiene ninguno, no se renderiza nada.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

import type { IconRailItemConfig } from '../lib/icon-rail-items'

import { IconRailFlyout } from './icon-rail-flyout'

export interface IconRailItemProps {
  item: IconRailItemConfig
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (pathname === href) return true
  // Considera activo si la ruta actual es hija de href.
  return pathname.startsWith(`${href}/`)
}

export function IconRailItem({ item }: IconRailItemProps) {
  const pathname = usePathname()
  const Icon = item.icon

  if (item.href) {
    const active = isActive(pathname, item.href)
    return (
      <Link
        href={item.href}
        aria-label={item.label}
        className={`flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-foreground transition-colors hover:bg-accent/40 ${
          active ? 'bg-accent text-foreground' : ''
        }`}
      >
        <Icon className="size-5 text-muted-foreground" />
        <span className="text-[10px] leading-tight">{item.label}</span>
      </Link>
    )
  }

  if (!item.flyout) return null

  const flyout = item.flyout
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={item.label}
          className="flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-foreground transition-colors hover:bg-accent/40"
        >
          <Icon className="size-5 text-muted-foreground" />
          <span className="text-[10px] leading-tight">{item.label}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={4}
        className="w-60 p-3"
      >
        <IconRailFlyout flyout={flyout} />
      </HoverCardContent>
    </HoverCard>
  )
}
