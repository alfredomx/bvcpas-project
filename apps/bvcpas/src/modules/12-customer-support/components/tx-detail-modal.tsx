'use client'

// Modal de detalle de una transacción uncategorized / AMA.
// D-bvcpas-042: usa <Dialog> shadcn (no Sheet — es acción puntual centrada).
//
// v0.5.5: diseño completo, guardado es placeholder hasta que mapi
// exponga el endpoint autenticado (D-bvcpas-045).

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  saveTransactionNote,
  type Transaction,
} from '@/modules/14-transactions/api/transactions.api'
import type { QboAccount } from '@/modules/14-transactions/api/qbo-accounts.api'

import { buildNotePreview, useNoteSuffix } from '../hooks/use-note-suffix'
import { formatAmount } from '../lib/format'

export interface TxDetailModalProps {
  transaction: Transaction | null
  realmId: string | null
  /** Lista de cuentas QBO — cargada en el orquestador (CustomerSupportScreen). */
  accounts: QboAccount[]
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
  accounts,
  open,
  onClose,
}: TxDetailModalProps) {
  const queryClient = useQueryClient()
  const accountsLoading = false
  const accountsError = false

  const { suffix, setSuffix } = useNoteSuffix()
  const [note, setNote] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [updateInQb, setUpdateInQbState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('bvcpas.updateInQb') === 'true'
  })

  const setUpdateInQb = (v: boolean) => {
    window.localStorage.setItem('bvcpas.updateInQb', String(v))
    setUpdateInQbState(v)
  }

  // Pre-llenar nota + account cuando abre el modal o cambia la transacción.
  useEffect(() => {
    if (!transaction) return
    // Prioridad: response.qbo_account_id > item.qbo_account_id
    const accountId =
      transaction.response?.qbo_account_id ??
      transaction.qbo_account_id ??
      ''
    setSelectedAccount(accountId)
    setNote(transaction.response?.client_note ?? '')
    setComboOpen(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id, open])

  const selectedAccountName =
    accounts.find((a) => a.Id === selectedAccount)?.Name ?? ''

  if (!transaction) return null

  const preview = buildNotePreview(note, suffix)

  const handleSave = async () => {
    if (!note.trim()) {
      toast.error('Please enter a note before saving.')
      return
    }
    setIsSaving(true)
    try {
      // completed = el operador anotó Y eligió una cuenta distinta a la original.
      // El frontend decide esto porque ya tiene ambos valores y evita que mapi
      // tenga que cargar el catálogo de cuentas para saberlo.
      const completed =
        !!note.trim() &&
        !!selectedAccount &&
        selectedAccount !== transaction.qbo_account_id

      await saveTransactionNote(transaction.client_id, transaction.id, {
        note: note.trim(),
        qbo_account_id: selectedAccount || null,
        completed,
      })
      // Invalida el cache de transacciones para que al reabrir el modal
      // los datos reflejen el response recién guardado.
      queryClient.invalidateQueries({ queryKey: ['transactions', transaction.client_id] })
      queryClient.invalidateQueries({ queryKey: ['uncats-detail', transaction.client_id] })
      toast.success('Note saved.')
      onClose()
    } catch {
      toast.error('Could not save note. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-200" aria-describedby={undefined}>
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

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="update-in-qb"
              checked={updateInQb}
              onCheckedChange={(v) => setUpdateInQb(v === true)}
            />
            <Label htmlFor="update-in-qb" className="cursor-pointer font-normal">
              Update in QB&apos;s
            </Label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
