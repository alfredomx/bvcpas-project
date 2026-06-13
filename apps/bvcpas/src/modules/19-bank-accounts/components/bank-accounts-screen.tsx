'use client'

import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Landmark, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionHeader } from '@/components/shared/section-header'

import { useClients } from '@/modules/11-clients/hooks/use-clients'

import { listBankAccounts, type BankLogin, type BankLoginStatus } from '../api/bank-accounts.api'
import { BANK_LOGIN_ACCOUNTS_QUERY_KEY } from '../hooks/use-bank-login-accounts'
import { useBankLogins } from '../hooks/use-bank-logins'

import { BankLoginFormDialog } from './bank-login-form-dialog'
import { BankLoginSheet } from './bank-login-sheet'
import { CredentialCard } from './credential-card'
import { DeleteBankLoginDialog } from './delete-bank-login-dialog'
import { ManagePortalsSheet } from './manage-portals-sheet'

export function BankAccountsScreen() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [selected, setSelected] = useState<BankLogin | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BankLogin | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankLogin | null>(null)
  const [bankSearch, setBankSearch] = useState('')
  const [managePortalsOpen, setManagePortalsOpen] = useState(false)
  // null = modo per-cliente (filtro local). string = búsqueda global
  // cross-cliente activa con ese término (combo bloqueado).
  const [globalTerm, setGlobalTerm] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<BankLoginStatus | 'all'>('all')

  const { items: clients } = useClients()
  const selectedClient = clients.find((c) => c.id === clientId) ?? null

  const globalMode = globalTerm !== null
  const showResults = globalMode || clientId !== null

  // Modo global: búsqueda cross-cliente vía backend (?search=, sin
  // clientId). Modo per-cliente: credenciales del cliente seleccionado.
  const query = useBankLogins(
    globalMode ? { search: globalTerm } : { clientId: clientId ?? undefined },
    { enabled: showResults },
  )
  const logins = query.data?.items ?? []
  const term = bankSearch.trim().toLowerCase()

  // Filtro local por cuenta: solo en modo per-cliente y con texto. Carga
  // las cuentas reusando el queryKey de las cards (React Query dedupea).
  const accountQueries = useQueries({
    queries: logins.map((l) => ({
      queryKey: [BANK_LOGIN_ACCOUNTS_QUERY_KEY, l.id],
      queryFn: () => listBankAccounts(l.id),
      enabled: !globalMode && term.length > 0,
    })),
  })
  const accountsByLogin = new Map(logins.map((l, i) => [l.id, accountQueries[i]?.data?.data ?? []]))

  // Filtro de texto: en modo global el backend ya filtró; en local
  // matchea banco + notes + cuentas.
  const matchesText = (l: BankLogin) => {
    if (globalMode || !term) return true
    if (l.portal.name.toLowerCase().includes(term)) return true
    if ((l.notes ?? '').toLowerCase().includes(term)) return true
    return (accountsByLogin.get(l.id) ?? []).some(
      (a) =>
        a.account_mask.toLowerCase().includes(term) ||
        (a.label ?? '').toLowerCase().includes(term) ||
        a.account_type.toLowerCase().includes(term),
    )
  }
  // El filtro de estatus afecta todo lo visible (ambos modos).
  const filteredLogins = logins.filter(
    (l) => (statusFilter === 'all' || l.status === statusFilter) && matchesText(l),
  )

  const runGlobalSearch = () => {
    const t = bankSearch.trim()
    if (t) setGlobalTerm(t)
  }
  const clearSearch = () => {
    setGlobalTerm(null)
    setBankSearch('')
  }

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (login: BankLogin) => {
    setEditTarget(login)
    setFormOpen(true)
  }

  return (
    <div className="flex w-full flex-col gap-4 px-6 py-6">
      <SectionHeader
        kicker="Bank Accounts"
        title="Client bank logins"
        description="Pick a client to see their bank portal credentials and the accounts inside each login."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManagePortalsOpen(true)}
          >
            <Landmark className="size-4" />
            Manage portals
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="bank-search">Search</Label>
          <div className="flex items-center gap-2">
            <Input
              id="bank-search"
              type="search"
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runGlobalSearch()
              }}
              placeholder="Filter by bank, account, notes…"
              className="w-[480px] max-w-full"
              disabled={globalMode}
              aria-label="Filter credentials by bank, account or notes"
            />
            {globalMode ? (
              <Button type="button" variant="outline" onClick={clearSearch}>
                Limpiar
              </Button>
            ) : (
              <Button type="button" onClick={runGlobalSearch} disabled={!bankSearch.trim()}>
                <Search className="size-4" />
                Buscar
              </Button>
            )}
          </div>
        </div>

        {showResults && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as BankLoginStatus | 'all')}
            >
              <SelectTrigger id="status-filter" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2 md:ml-auto">
          <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-[280px] justify-between"
                disabled={globalMode}
              >
                <span className="min-w-0 truncate">
                  {selectedClient?.legal_name ?? 'Select a client…'}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0">
              <Command>
                <CommandInput placeholder="Search client…" />
                <CommandList>
                  <CommandEmpty>No clients found.</CommandEmpty>
                  <CommandGroup>
                    {clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.legal_name}
                        onSelect={() => {
                          setClientId(c.id)
                          setBankSearch('')
                          setClientPickerOpen(false)
                        }}
                      >
                        <Check
                          className={`mr-2 size-4 ${clientId === c.id ? 'opacity-100' : 'opacity-0'}`}
                        />
                        {c.legal_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {!globalMode && clientId !== null && (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add bank login
            </Button>
          )}
        </div>
      </div>

      {!showResults && <SelectClientPrompt />}

      {showResults && query.isLoading && <CardsLoading />}

      {showResults && query.isError && (
        <CardsError
          message={query.error?.message ?? 'Could not load bank logins.'}
          onRetry={() => query.refetch()}
        />
      )}

      {showResults &&
        query.data &&
        logins.length === 0 &&
        (globalMode ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground">
            No credentials match &ldquo;{globalTerm}&rdquo; across clients.
          </div>
        ) : (
          <CredentialsEmpty onAdd={openCreate} />
        ))}

      {showResults && query.data && logins.length > 0 && filteredLogins.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground">
          No matches for the current filters.
        </div>
      )}

      {showResults && query.data && filteredLogins.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredLogins.map((login) => (
            <CredentialCard
              key={login.id}
              login={login}
              showClient={globalMode}
              onOpenAccounts={(l) => {
                setSelected(l)
                setSheetOpen(true)
              }}
              onEdit={openEdit}
              onDelete={(l) => setDeleteTarget(l)}
            />
          ))}
        </div>
      )}

      <BankLoginSheet open={sheetOpen} onOpenChange={setSheetOpen} login={selected} />

      <BankLoginFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        login={editTarget}
        lockedClientId={editTarget === null ? (clientId ?? undefined) : undefined}
        lockedClientName={
          editTarget === null ? (selectedClient?.legal_name ?? undefined) : undefined
        }
      />

      <DeleteBankLoginDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        login={deleteTarget}
      />

      <ManagePortalsSheet open={managePortalsOpen} onOpenChange={setManagePortalsOpen} />
    </div>
  )
}

function SelectClientPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center">
      <p className="text-sm font-medium">Select a client to view their bank logins</p>
      <p className="text-xs text-muted-foreground">
        Use the picker above to choose a client. Their portal credentials show here.
      </p>
    </div>
  )
}

function CardsLoading() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-md border bg-muted/30" />
      ))}
    </div>
  )
}

function CredentialsEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border bg-muted/20 px-6 py-10 text-center">
      <p className="text-sm font-medium">No bank logins for this client yet</p>
      <p className="text-xs text-muted-foreground">
        Add a portal login to start tracking this client&rsquo;s bank credentials.
      </p>
      <Button type="button" size="sm" className="mt-2" onClick={onAdd}>
        <Plus className="size-4" />
        Add bank login
      </Button>
    </div>
  )
}

function CardsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
      <p className="text-sm font-medium text-destructive">Could not load bank logins</p>
      <p className="text-xs text-muted-foreground">{message}</p>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  )
}
