'use client'

// Header reusable para subsecciones del shell (Integrations,
// Reports, etc.). Mismo formato que el header del Client Home pero
// parametrizable. Los chips/meta del Client Home siguen viviendo en
// `<ChHeader>` (composición), no aquí.

import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  kicker: string
  title: string
  description?: string
  actions?: ReactNode
}

export function SectionHeader({
  kicker,
  title,
  description,
  actions,
}: SectionHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b py-4 md:flex-row md:items-start md:justify-between">
      <div className="flex max-w-3xl flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {kicker}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}
