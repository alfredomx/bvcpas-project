'use client'

import { toast } from 'sonner'

import { useSession } from '@/modules/10-core-auth/hooks/use-session'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
        <button type="button" aria-label="Open user menu" className="rounded-full">
          <Avatar className="size-8">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={() => toast.message('Coming soon.')}>
          Change profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
