'use client'

// Topbar de la app autenticada. Siempre [nombre + avatar].
// Sin KPIs ni breadcrumbs (decisión confirmada con el operador).

import { useSession } from '@/modules/10-core-auth/hooks/use-session'

import { AvatarMenu } from './avatar-menu'

export function Topbar() {
  const { user } = useSession()

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-border-default bg-surface-canvas px-6">
      {user && <span className="text-sm font-medium text-text-primary">{user.fullName}</span>}
      <AvatarMenu />
    </header>
  )
}
