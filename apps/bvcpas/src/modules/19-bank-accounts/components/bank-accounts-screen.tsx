'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/shared/section-header'

import type {
  BankLogin,
  ListBankLoginsParams,
} from '../api/bank-accounts.api'
import { useBankLogins } from '../hooks/use-bank-logins'

import { BankLoginFormDialog } from './bank-login-form-dialog'
import { BankLoginSheet } from './bank-login-sheet'
import { BankLoginsFilters } from './bank-logins-filters'
import { BankLoginsTable } from './bank-logins-table'
import { DeleteBankLoginDialog } from './delete-bank-login-dialog'

export function BankAccountsScreen() {
  const [filters, setFilters] = useState<ListBankLoginsParams>({})
  const [selected, setSelected] = useState<BankLogin | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BankLogin | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankLogin | null>(null)

  const query = useBankLogins(filters)
  const logins = query.data?.items ?? []

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (login: BankLogin) => {
    setEditTarget(login)
    setFormOpen(true)
  }

  return (
    <div className="flex w-full flex-col gap-3 px-6 py-6">
      <SectionHeader
        kicker="Bank Accounts"
        title="All client logins"
        description="Bank portal credentials for every client in the firm. Click a row to see the accounts inside that login."
        actions={
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add bank login
          </Button>
        }
      />

      <BankLoginsFilters value={filters} onChange={setFilters} />

      {query.isLoading && <LoginsLoading />}

      {query.isError && (
        <LoginsError
          message={query.error?.message ?? 'Could not load bank logins.'}
          onRetry={() => query.refetch()}
        />
      )}

      {query.data && logins.length === 0 && (
        <LoginsEmpty onAdd={openCreate} />
      )}

      {query.data && logins.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            Showing {logins.length} of {query.data.total} logins.
          </p>
          <BankLoginsTable
            logins={logins}
            onSelect={(l) => {
              setSelected(l)
              setSheetOpen(true)
            }}
            onEdit={openEdit}
            onDelete={(l) => setDeleteTarget(l)}
          />
        </>
      )}

      <BankLoginSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        login={selected}
        onEditLogin={(l) => {
          setSheetOpen(false)
          openEdit(l)
        }}
        onDeleteLogin={(l) => {
          setSheetOpen(false)
          setDeleteTarget(l)
        }}
      />

      <BankLoginFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        login={editTarget}
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

function LoginsLoading() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-md border bg-muted/30"
        />
      ))}
    </div>
  )
}

function LoginsEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border bg-muted/20 px-6 py-10 text-center">
      <p className="text-sm font-medium">No bank logins yet</p>
      <p className="text-xs text-muted-foreground">
        Add a portal login for a client to start tracking their bank
        credentials.
      </p>
      <Button type="button" size="sm" className="mt-2" onClick={onAdd}>
        <Plus className="size-4" />
        Add your first bank login
      </Button>
    </div>
  )
}

function LoginsError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-700">
        Could not load bank logins
      </p>
      <p className="text-xs text-red-600">{message}</p>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  )
}
