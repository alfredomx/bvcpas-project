'use client'

import { useSession } from '@/modules/10-core-auth/hooks/use-session'

import { AvatarMenu } from './avatar-menu'

export function Topbar() {
  const { user } = useSession()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <span className="font-semibold">bvcpas</span>
      <span className="flex-1" />
      {user && <span className="text-sm">{user.fullName}</span>}
      <AvatarMenu />
    </header>
  )
}
