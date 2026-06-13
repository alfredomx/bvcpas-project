'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SectionHeader } from '@/components/shared/section-header'

import { useClients } from '@/modules/11-clients/hooks/use-clients'

import type { BankLogin } from '../api/bank-accounts.api'
import { useBankLogins } from '../hooks/use-bank-logins'

import { BankLoginFormDialog } from './bank-login-form-dialog'
import { BankLoginSheet } from './bank-login-sheet'
import { CredentialCard } from './credential-card'
import { DeleteBankLoginDialog } from './delete-bank-login-dialog'

export function BankAccountsScreen() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [selected, setSelected] = useState<BankLogin | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BankLogin | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankLogin | null>(null)
  const [bankSearch, setBankSearch] = useState('')

  const { items: clients } = useClients()
  const selectedClient = clients.find((c) => c.id === clientId) ?? null

  const query = useBankLogins({ clientId: clientId ?? undefined }, { enabled: clientId !== null })
  const logins = query.data?.items ?? []
  const term = bankSearch.trim().toLowerCase()
  const filteredLogins = term
    ? logins.filter((l) => l.portal.name.toLowerCase().includes(term))
    : logins

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
      />

      <div className="flex flex-wrap items-center gap-2">
        <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-[280px] justify-between">
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

        {clientId !== null && (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add bank login
          </Button>
        )}

        {clientId !== null && logins.length > 0 && (
          <Input
            type="search"
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            placeholder="Filter by bank…"
            className="w-[220px] md:ml-auto"
            aria-label="Filter credentials by bank"
          />
        )}
      </div>

      {clientId === null && <SelectClientPrompt />}

      {clientId !== null && query.isLoading && <CardsLoading />}

      {clientId !== null && query.isError && (
        <CardsError
          message={query.error?.message ?? 'Could not load bank logins.'}
          onRetry={() => query.refetch()}
        />
      )}

      {clientId !== null && query.data && logins.length === 0 && (
        <CredentialsEmpty onAdd={openCreate} />
      )}

      {clientId !== null && query.data && logins.length > 0 && filteredLogins.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground">
          No bank matches &ldquo;{bankSearch}&rdquo;.
        </div>
      )}

      {clientId !== null && query.data && filteredLogins.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredLogins.map((login) => (
            <CredentialCard
              key={login.id}
              login={login}
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
