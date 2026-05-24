'use client'

import type { ReactNode } from 'react'

import { IconRail } from './icon-rail'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
