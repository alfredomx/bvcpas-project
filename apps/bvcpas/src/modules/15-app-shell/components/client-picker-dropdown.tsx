'use client'

// Dropdown que reemplaza la sidebar en "modo topbar".
// Muestra el cliente activo en un botón estilo select; al hacer click
// abre un popover con buscador + lista de clientes.
//
// La lista NO usa virtualización (a diferencia de la sidebar). Razón:
// el Popover de Radix mide su contenido al abrir, y el virtualizer
// necesita el scrollRef con dimensiones reales antes del primer
// render — daba lista en blanco cada vez que se abría. Con ~70
// clientes no hay penalización medible por renderizar todo.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronDown, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useClients } from '@/modules/11-clients/hooks/use-clients'

export function ClientPickerDropdown() {
  const router = useRouter()
  const params = useParams()
  const activeClientId =
    typeof params?.clientId === 'string' ? params.clientId : undefined

  const { items } = useClients()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const activeClient = useMemo(
    () => items.find((c) => c.id === activeClientId),
    [items, activeClientId],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.legal_name.toLowerCase().includes(q))
  }, [items, search])

  const handleSelect = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`)
    setOpen(false)
    setSearch('')
  }

  const label = activeClient?.legal_name ?? 'Select client…'

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-72 justify-between"
        >
          <span className="truncate text-sm">{label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        sideOffset={6}
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a client"
              className="pl-8"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No clients found.
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((item) => {
                const isActive = item.id === activeClientId
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-accent font-medium'
                          : 'hover:bg-accent/40'
                      }`}
                    >
                      <span className="truncate">{item.legal_name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
