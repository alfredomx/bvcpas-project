'use client'

// Orquestador del shell autenticado: Sidebar (izq) + Topbar (arriba) +
// main con children (centro).
//
// Layout: sidebar full-height a la izquierda, topbar arriba a la
// derecha, main scrollable abajo. La sesión + guard viven en
// (authenticated)/layout.tsx que envuelve a <AppShell>.

import type { ReactNode } from 'react'

import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-surface-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
