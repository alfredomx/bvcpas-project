'use client'

import {
  Bell,
  ChevronDown,
  Clipboard,
  HelpCircle,
  Search,
  Settings,
  Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSession } from '@/modules/10-core-auth/hooks/use-session'

import { useSidebarCollapsed } from '../hooks/use-sidebar-collapsed'
import { AvatarMenu } from './avatar-menu'
import { ClientPickerDropdown } from './client-picker-dropdown'

export function Topbar() {
  const { user } = useSession()
  const { collapsed, setCollapsed } = useSidebarCollapsed()

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <div className="flex items-center gap-3">
        <span className="font-semibold">bvcpas</span>
        {collapsed && (
          <>
            <ClientPickerDropdown />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(false)}
              aria-label="Show sidebar"
            >
              <ChevronDown />
            </Button>
          </>
        )}
      </div>

      {/* Search placeholder — centrado respecto al viewport, sin
          dejarse empujar por los grupos izq/der. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-center px-4 md:flex">
        <div className="pointer-events-auto relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Navigate. Find transactions, contacts, help, reports, and more."
            className="h-9 pl-9"
            aria-label="Global search (coming soon)"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Clipboard">
          <Clipboard />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Achievements">
          <Trophy />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Settings">
          <Settings />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Help">
          <HelpCircle />
        </Button>
        {user && (
          <span className="ml-2 hidden text-sm md:inline">{user.fullName}</span>
        )}
        <AvatarMenu />
      </div>
    </header>
  )
}
