'use client'

// Topbar de la app autenticada. Logo izquierda + [nombre + avatar] derecha.
// Sin KPIs ni breadcrumbs (decisión confirmada con el operador).
//
// Estilo 1:1 con reference/cs-navy2.css .stream-topbar:
//   background: linear-gradient(135deg, #1a2244 0%, #243064 50%, #2a356b 100%)
//   border-bottom: 3px solid var(--orange-0)  ← brand-accent
//   color: #fff
//   padding: 14px 22px
//   height: 70px (medido)

/* eslint-disable @next/next/no-img-element */

import { useSession } from '@/modules/10-core-auth/hooks/use-session'

import { AvatarMenu } from './avatar-menu'

export function Topbar() {
  const { user } = useSession()

  return (
    <header
      className="flex h-17.5 items-center gap-3 border-b-[3px] border-brand-accent py-3.5 pl-5.5 pr-5.5 text-text-inverse"
      style={{
        background: 'linear-gradient(135deg, #1a2244 0%, #243064 50%, #2a356b 100%)',
      }}
    >
      <div className="flex items-center rounded-xl bg-surface-lavender px-3 py-1.5 shadow-[0_2px_6px_rgba(26,34,68,0.18)]">
        <img
          src="/images/brand/logo.png"
          alt="bvcpas"
          className="h-auto max-h-9 w-auto max-w-36 select-none object-contain"
          draggable={false}
        />
      </div>
      <span className="flex-1" />
      {user && (
        <span className="text-[15px] font-semibold tracking-tight text-text-inverse">
          {user.fullName}
        </span>
      )}
      <AvatarMenu />
    </header>
  )
}
