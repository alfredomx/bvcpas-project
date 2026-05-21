'use client'

// Contenedor de la pantalla pública. Maneja loading/error/expired y
// monta el grid 2 columnas con la lista y el detalle.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Skeleton } from '@/components/ui/skeleton'

import type { ApiError } from '../api/public-uncats.api'
import { usePublicUncats } from '../hooks/use-public-uncats'
import { buildOrdered } from '../lib/grouping'

import { PuHeader } from './pu-header'
import { PuTransactionDetail } from './pu-transaction-detail'
import { PuTransactionsList } from './pu-transactions-list'

export interface PublicUncatsScreenProps {
  token: string
}

export function PublicUncatsScreen({ token }: PublicUncatsScreenProps) {
  const { data, isLoading, isError, error } = usePublicUncats(token)
  const router = useRouter()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Si el backend dice 410, redirigir a /expired.
  useEffect(() => {
    if (!isError) return
    const apiErr = error as ApiError | null
    if (apiErr && apiErr.code === 'PUBLIC_LINK_REVOKED') {
      router.replace(`/p/uncats/${token}/expired`)
    }
  }, [isError, error, router, token])

  const orderedItems = useMemo(
    () => (data ? buildOrdered(data.items) : []),
    [data],
  )

  // Auto-seleccionar el primer item cuando se carga la data, o cuando
  // el item seleccionado deja de existir (ej. cambió el response y la
  // lista se reordenó por algún motivo).
  useEffect(() => {
    if (orderedItems.length === 0) return
    if (!selectedId || !orderedItems.some((i) => i.id === selectedId)) {
      setSelectedId(orderedItems[0].id)
    }
  }, [orderedItems, selectedId])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    const apiErr = error as ApiError | null
    if (apiErr?.code === 'PUBLIC_LINK_REVOKED') {
      // Mientras corre el redirect.
      return (
        <div className="p-6 text-sm text-muted-foreground">Redirecting…</div>
      )
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <h2 className="text-lg font-semibold">Could not load this page</h2>
        <p className="text-sm text-muted-foreground">
          Check the link or try again later.
        </p>
      </div>
    )
  }

  if (!data) return null

  const selectedIndex = orderedItems.findIndex((i) => i.id === selectedId)
  const selected = selectedIndex >= 0 ? orderedItems[selectedIndex] : null
  const hasPrev = selectedIndex > 0
  const hasNext = selectedIndex >= 0 && selectedIndex < orderedItems.length - 1

  const goPrev = () => {
    if (hasPrev) setSelectedId(orderedItems[selectedIndex - 1].id)
  }
  const goNext = () => {
    if (hasNext) setSelectedId(orderedItems[selectedIndex + 1].id)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PuHeader client={data.client} items={data.items} />
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[5fr_7fr]">
        <aside className="hidden min-h-0 flex-col border-r md:flex md:overflow-hidden">
          <PuTransactionsList
            items={orderedItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isEditing={isEditing}
          />
        </aside>
        <main className="min-h-0 overflow-y-auto">
          <PuTransactionDetail
            token={token}
            transaction={selected}
            onEditingChange={setIsEditing}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            currentIndex={selectedIndex}
            total={orderedItems.length}
          />
        </main>
      </div>
    </div>
  )
}
