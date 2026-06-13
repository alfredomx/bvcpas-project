'use client'

import { useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

import type { BankPortal } from '../api/bank-accounts.api'
import { useBankPortals } from '../hooks/use-bank-portals'

import { BankPortalFormDialog } from './bank-portal-form-dialog'
import { DeletePortalDialog } from './delete-portal-dialog'

export interface ManagePortalsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManagePortalsSheet({ open, onOpenChange }: ManagePortalsSheetProps) {
  const portalsQuery = useBankPortals()
  const portals = portalsQuery.data?.data ?? []
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BankPortal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankPortal | null>(null)

  const term = search.trim().toLowerCase()
  const filtered = term ? portals.filter((p) => p.name.toLowerCase().includes(term)) : portals

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }
  const openEdit = (p: BankPortal) => {
    setEditTarget(p)
    setFormOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[480px] p-0 sm:max-w-[480px]">
          <SheetHeader className="gap-3 border-b p-6">
            <SheetTitle>Manage portals</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Catalog of login providers (banks, utilities, payroll, etc.) shared across all
              clients.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search portal…"
                className="h-9"
                aria-label="Search portal"
              />
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </SheetHeader>

          <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-3">
            {portalsQuery.isLoading && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</p>
            )}
            {!portalsQuery.isLoading && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {portals.length === 0
                  ? 'No portals yet. Click “Add” to create one.'
                  : 'No portals match your search.'}
              </p>
            )}
            <div className="flex flex-col">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent/30"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    {p.portal_url && (
                      <a
                        href={p.portal_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
                      >
                        <span className="truncate">{p.portal_url}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Edit portal"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Delete portal"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <BankPortalFormDialog open={formOpen} onOpenChange={setFormOpen} portal={editTarget} />

      <DeletePortalDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        portal={deleteTarget}
      />
    </>
  )
}
