'use client'

import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSession } from '@/modules/10-core-auth/hooks/use-session'

import { useSidebarCollapsed } from '../hooks/use-sidebar-collapsed'
import { AvatarMenu } from './avatar-menu'
import { ClientPickerDropdown } from './client-picker-dropdown'

export function Topbar() {
  const { user } = useSession()
  const { collapsed, setCollapsed } = useSidebarCollapsed()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
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
      <span className="flex-1" />
      {user && <span className="text-sm">{user.fullName}</span>}
      <AvatarMenu />
    </header>
  )
}
