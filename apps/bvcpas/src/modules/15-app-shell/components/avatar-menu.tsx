'use client'

// Dropdown del avatar (estilo Crunchyroll).
// v0.3.0:
//   - Trigger: círculo navy con la inicial del fullName.
//   - "Change profile" → toast placeholder.
//   - "Logout" → useSession().logout().
//
// Cuando mapi exponga avatar.url, el trigger lo mostrará en lugar de
// la inicial.

import { LogOut, UserCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { useSession } from '@/modules/10-core-auth/hooks/use-session'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function getInitial(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export function AvatarMenu() {
  const { user, logout } = useSession()
  if (!user) return null

  const initial = getInitial(user.fullName)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className={cn(
            'flex size-9 items-center justify-center rounded-full bg-brand-navy text-sm font-semibold text-text-inverse',
            'transition hover:bg-brand-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
          )}
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={() => toast.message('Coming soon.')}>
          <UserCircle2 className="size-4" />
          Change profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
