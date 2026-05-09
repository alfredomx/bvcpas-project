'use client'

import { use } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { useClients } from '@/modules/11-clients/hooks/use-clients'
import { ClientTabs } from '@/modules/15-app-shell/components/client-tabs'

export default function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = use(params)
  const { items, isLoading } = useClients()

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center gap-2 border-b px-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  const exists = items.some((it) => it.id === clientId)

  if (!exists) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-wide text-destructive">Not found</p>
        <h2 className="text-xl font-semibold">Client not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          The client in the URL does not exist or you do not have access.
        </p>
      </section>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ClientTabs clientId={clientId} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
