'use client'

// Modal de detalle de una transacción uncategorized / AMA.
// D-bvcpas-042: usa <Dialog> shadcn (no Sheet — es acción puntual centrada).
//
// v0.5.5: diseño completo, guardado es placeholder hasta que mapi
// exponga el endpoint autenticado (D-bvcpas-045).

import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { Transaction } from '@/modules/14-transactions/api/transactions.api'
import { useQboAccounts } from '@/modules/14-transactions/hooks/use-qbo-accounts'

import { buildNotePreview, useNoteSuffix } from '../hooks/use-note-suffix'
import { formatAmount } from '../lib/format'

export interface TxDetailModalProps {
  transaction: Transaction | null
  realmId: string | null
  open: boolean
  onClose: () => void
}

function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[2]}/${m[3]}/${m[1]}`
}

function categoryLabel(cat: Transaction['category']): string {
  if (cat === 'uncategorized_expense') return 'UNCATEGORIZED EXPENSE'
  if (cat === 'uncategorized_income') return 'UNCATEGORIZED INCOME'
  return 'ASK MY ACCOUNTANT'
}

function txTypeLabel(qboTxnType: string): string {
  return qboTxnType.toUpperCase()
}

function signedAmount(t: Transaction): string {
  const formatted = formatAmount(t.amount)
  if (t.category === 'uncategorized_income') return formatted
  return formatted.startsWith('-') ? formatted : `-${formatted}`
}

export function TxDetailModal({
  transaction,
  realmId,
  open,
  onClose,
}: TxDetailModalProps) {
  const { accounts, isLoading: accountsLoading, isError: accountsError } =
    useQboAccounts(realmId)

  const { suffix, setSuffix } = useNoteSuffix()
  const [note, setNote] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [comboOpen, setComboOpen] = useState(false)

  const selectedAccountName =
    accounts.find((a) => a.Id === selectedAccount)?.Name ?? ''

  if (!transaction) return null

  const preview = buildNotePreview(note, suffix)

  const handleSave = () => {
    // D-bvcpas-045: placeholder hasta que mapi exponga endpoint autenticado.
    toast.message('Coming soon — backend endpoint pending.')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{txTypeLabel(transaction.qbo_txn_type)}</Badge>
                <Badge variant="outline">{categoryLabel(transaction.category)}</Badge>
              </div>
              <DialogTitle className="text-xl">
                {transaction.vendor_name ?? '—'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                id{' '}
                <span className="font-mono">{transaction.qbo_txn_id}</span>
                {' · '}date{' '}
                <span className="font-medium">{formatDate(transaction.txn_date)}</span>
                {transaction.split_account && (
                  <>
                    {' · '}account{' '}
                    <span className="font-medium">{transaction.split_account}</span>
                  </>
                )}
              </p>
            </div>
            <span className="shrink-0 text-2xl font-bold">
              {signedAmount(transaction)}
            </span>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Bank memo */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Bank memo / description
            </Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
              {transaction.memo ?? '—'}
            </div>
          </div>

          {/* Account combobox with search */}
          <div className="flex flex-col gap-1.5">
            <Label>Category / account</Label>
            {realmId === null ? (
              <p className="text-sm text-muted-foreground">
                QBO not connected — connect QuickBooks to load accounts.
              </p>
            ) : accountsError ? (
              <p className="text-sm text-destructive">Could not load accounts.</p>
            ) : (
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    disabled={accountsLoading}
                    className="justify-between font-normal"
                  >
                    {accountsLoading
                      ? 'Loading accounts…'
                      : selectedAccountName || 'Search account…'}
                    <span className="ml-2 shrink-0 text-muted-foreground">⌄</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command>
                    <CommandInput placeholder="Search account…" />
                    <CommandList>
                      <CommandEmpty>No account found.</CommandEmpty>
                      <CommandGroup>
                        {accounts.map((acc) => (
                          <CommandItem
                            key={acc.Id}
                            value={acc.Name}
                            onSelect={() => {
                              setSelectedAccount(acc.Id)
                              setComboOpen(false)
                            }}
                          >
                            <span className="flex-1">{acc.Name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {acc.AccountType}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Client note */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-note">What was this transaction for?</Label>
            <Textarea
              id="client-note"
              rows={4}
              placeholder="Tell the client what this was for. Be as specific as you can — vendor, purpose, project, customer name…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Note suffix (editable, persisted in localStorage) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-suffix" className="text-xs text-muted-foreground">
              Appended text (saved per user)
            </Label>
            <Input
              id="note-suffix"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder=" - as per client's notes"
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <p className="mt-1 text-sm">{preview}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
