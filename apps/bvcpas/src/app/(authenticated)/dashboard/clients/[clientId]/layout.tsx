'use client'

// Layout de un cliente: barra de tabs + children (el contenido de la
// tab activa).
//
// Si el clientId de la URL no existe en la lista de clientes (devuelta
// por useClientsList), se muestra "Client not found" en el panel
// derecho. La sidebar sigue funcionando normal.

import { use } from 'react'
import { FileQuestion } from 'lucide-react'

import { useClientsList } from '@/modules/13-dashboards/hooks/use-clients-list'
import { ClientTabs } from '@/modules/15-app-shell/components/client-tabs'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = use(params)
  const { items, isLoading } = useClientsList()

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center gap-2 border-b border-border-default px-4">
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

  const exists = items.some((it) => it.client_id === clientId)

  if (!exists) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-status-danger-bg">
          <FileQuestion className="size-6 text-status-danger" aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-status-danger">
            Not found
          </p>
          <h2 className="text-[22px] font-bold tracking-tight text-brand-navy">Client not found</h2>
        </div>
        <p className="max-w-sm text-[13px] leading-relaxed text-text-muted">
          The client in the URL does not exist or you do not have access. Pick another from the
          sidebar.
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
