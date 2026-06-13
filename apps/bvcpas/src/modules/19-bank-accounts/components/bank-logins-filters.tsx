'use client'

import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useClients } from '@/modules/11-clients/hooks/use-clients'

import type { ListBankLoginsParams } from '../api/bank-accounts.api'
import { useBankPortals } from '../hooks/use-bank-portals'

const ALL = '__all__'

export interface BankLoginsFiltersProps {
  value: ListBankLoginsParams
  onChange: (next: ListBankLoginsParams) => void
}

export function BankLoginsFilters({ value, onChange }: BankLoginsFiltersProps) {
  const [searchInput, setSearchInput] = useState(value.search ?? '')
  const { items: clients } = useClients()
  const portalsQuery = useBankPortals()
  const portals = portalsQuery.data?.data ?? []

  // Debounce del search input.
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim()
      onChange({ ...value, search: trimmed || undefined })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <Input
        type="search"
        placeholder="Search by client, portal, or notes…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="md:max-w-sm"
      />
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select
          value={value.clientId ?? ALL}
          onValueChange={(v) =>
            onChange({ ...value, clientId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.portalId ?? ALL}
          onValueChange={(v) =>
            onChange({ ...value, portalId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All portals" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All portals</SelectItem>
            {portals.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.status ?? ALL}
          onValueChange={(v) =>
            onChange({
              ...value,
              status:
                v === ALL ? undefined : (v as ListBankLoginsParams['status']),
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
