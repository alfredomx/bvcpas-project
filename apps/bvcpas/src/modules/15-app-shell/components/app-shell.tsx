'use client'

// Orquestador del shell autenticado.
//
// Layout 1:1 con reference/customer-support-navy-v2.html:
//   ┌───────────────────────────────────────────┐
//   │ Topbar (full-width, 70px)                  │
//   ├───────────────────────────────────────────┤
//   │ Sidebar (412px) │ main (children)          │
//   │                 │                          │
//   └───────────────────────────────────────────┘
//
// La sesión + guard viven en (authenticated)/layout.tsx que envuelve
// a <AppShell>.

import type { ReactNode } from 'react'

import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col bg-surface-canvas">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
