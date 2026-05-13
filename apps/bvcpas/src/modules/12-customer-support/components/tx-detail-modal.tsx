'use client'

// Modal de detalle de una transacción uncategorized / AMA.
// D-bvcpas-042: usa <Dialog> shadcn (no Sheet — es acción puntual centrada).
//
// v0.5.5: diseño completo, guardado es placeholder hasta que mapi
// exponga el endpoint autenticado (D-bvcpas-045).

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  deleteTransactionResponse,
  saveTransactionNote,
  type Transaction,
} from '@/modules/14-transactions/api/transactions.api'
import type { QboAccount } from '@/modules/14-transactions/api/qbo-accounts.api'
import { buildAccountTree } from '@/modules/14-transactions/lib/qbo-accounts-tree'

import { updateFollowup } from '../api/followups.api'
import {
  buildAppendedText,
  buildNotePreview,
  useNoteSuffix,
} from '../hooks/use-note-suffix'
import { currentPeriod } from '../lib/date-range'
import { formatAmount } from '../lib/format'
import {
  computeNextFollowupStatus,
  type FollowupStatus,
} from '../lib/followup-status'

export interface TxDetailModalProps {
  transaction: Transaction | null
  realmId: string | null
  /** Lista de cuentas QBO — cargada en el orquestador (CustomerSupportScreen). */
  accounts: QboAccount[]
  open: boolean
  onClose: () => void
  /**
   * Datos del período para recalcular `followup.status` tras Save/Delete
   * sin esperar el refetch del detail (fix-followup-status-transitions).
   * Si alguno falta (ej. tests aislados), el bump del status se omite.
   */
  respondedCount?: number
  totalCount?: number
  followupStatus?: FollowupStatus
  followupSentAt?: string | null
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
  respondedCount,
  totalCount,
  followupStatus,
  followupSentAt,
}: TxDetailModalProps) {
  const queryClient = useQueryClient()
  const accountsLoading = false
  const accountsError = false

  const { suffix, setSuffix } = useNoteSuffix()
  const [note, setNote] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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
  const accountRows = useMemo(() => buildAccountTree(accounts), [accounts])

  if (!transaction) return null

  const preview = buildNotePreview(note, suffix)

  /**
   * Dispara PATCH /followups/:period con el status calculado por
   * `computeNextFollowupStatus` si difiere del actual. Si el padre no
   * pasó las props del período, no hace nada (caso tests aislados).
   *
   * `delta` es el cambio en `responded_count`: +1 si esta operación
   * marcó un completed nuevo, -1 si quitó uno completed, 0 si no
   * cambia el conteo.
   *
   * El total (`uncats_count`) NO cambia ni en Save ni en Delete de
   * response — la transacción QBO sigue siendo uncategorized en
   * ambos casos. Solo cambiaría si el operador desincronizara el
   * snapshot en QBO y volviera a sincronizar.
   *
   * Replica exactamente la fórmula de mapi:
   *   `progress_pct = round(responded / uncats * 100)`
   * (solo `uncats`, NO incluye AMAs).
   */
  const bumpFollowupStatusIfNeeded = async (delta: -1 | 0 | 1) => {
    if (
      respondedCount === undefined ||
      totalCount === undefined ||
      followupStatus === undefined ||
      !transaction
    ) {
      return
    }
    if (totalCount <= 0) return
    const nextResponded = Math.max(0, respondedCount + delta)
    const progressPct = Math.round((nextResponded / totalCount) * 100)
    const nextStatus = computeNextFollowupStatus({
      progressPct,
      sentAt: followupSentAt ?? null,
    })
    if (nextStatus === followupStatus) return
    try {
      await updateFollowup(transaction.client_id, currentPeriod(new Date()), {
        status: nextStatus,
      })
    } catch {
      // No-op: el cambio principal (save/delete) ya tuvo éxito. Si el
      // bump falla, el badge quedará desactualizado hasta el próximo
      // refetch. No queremos ensuciar el feedback al operador.
    }
  }

  const handleDelete = async () => {
    if (!transaction) return
    setIsDeleting(true)
    try {
      await deleteTransactionResponse(transaction.client_id, transaction.id)

      // La transacción QBO sigue válida (no se borra del snapshot), solo
      // pierde su response. Por eso `uncats_count` no cambia; solo baja
      // `responded_count` si la response que se borró estaba completed.
      const wasCompleted = transaction.response?.completed === true
      await bumpFollowupStatusIfNeeded(wasCompleted ? -1 : 0)

      queryClient.invalidateQueries({ queryKey: ['transactions', transaction.client_id] })
      queryClient.invalidateQueries({ queryKey: ['uncats-detail'] })
      toast.success('Response deleted.')
      setConfirmDeleteOpen(false)
      onClose()
    } catch {
      toast.error('Could not delete. Try again.')
    } finally {
      setIsDeleting(false)
    }
  }

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

      await saveTransactionNote(
        transaction.client_id,
        transaction.id,
        {
          note: note.trim(),
          qbo_account_id: selectedAccount || null,
          completed,
          // Mapi ignora este campo si qbo_sync=false; lo usa solo cuando
          // sincroniza, concatenándolo al client_note antes de escribir el
          // PrivateNote en QBO.
          appended_text: buildAppendedText(suffix),
        },
        { qboSync: updateInQb },
      )
      // Delta del `responded_count` con base en el estado previo vs el nuevo:
      // +1 si pasa de no-completed a completed, -1 si vuelve a no-completed,
      // 0 si no cambia.
      const wasCompleted = transaction.response?.completed === true
      const delta: -1 | 0 | 1 = completed && !wasCompleted
        ? 1
        : !completed && wasCompleted
          ? -1
          : 0
      await bumpFollowupStatusIfNeeded(delta)
      // Invalida el cache de transacciones para que al reabrir el modal
      // los datos reflejen el response recién guardado.
      queryClient.invalidateQueries({ queryKey: ['transactions', transaction.client_id] })
      queryClient.invalidateQueries({ queryKey: ['uncats-detail'] })
      toast.success('Note saved.')
      onClose()
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code
      const status = (err as { statusCode?: number } | undefined)?.statusCode

      // Errores que bloquean el guardado completo (validación 400).
      if (code === 'QBO_ACCOUNT_ID_REQUIRED') {
        toast.error('Select a QBO account before saving.')
      } else if (code === 'TXN_TYPE_NOT_SUPPORTED') {
        toast.error('Only Purchase and Deposit transactions are supported.')
      } else if (status === 409 || code === 'INTUIT_STALE_SYNC_TOKEN') {
        // 409: la nota local SÍ se guardó pero QBO necesita refresh.
        toast.warning('Note saved, but QBO data is stale. Refresh and try again.')
        queryClient.invalidateQueries({ queryKey: ['transactions', transaction.client_id] })
        queryClient.invalidateQueries({ queryKey: ['uncats-detail', transaction.client_id] })
      } else if (status === 502 || code === 'INTUIT_API_ERROR') {
        // 502: la nota local SÍ se guardó pero el writeback a QBO falló.
        toast.warning('Note saved, but QuickBooks update failed. You can retry sync later.')
        queryClient.invalidateQueries({ queryKey: ['transactions', transaction.client_id] })
        queryClient.invalidateQueries({ queryKey: ['uncats-detail', transaction.client_id] })
      } else {
        toast.error('Could not save note. Try again.')
      }
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
                        {accountRows.map((row) => (
                          <CommandItem
                            key={row.Id}
                            value={row.searchText}
                            onSelect={() => {
                              setSelectedAccount(row.Id)
                              setComboOpen(false)
                            }}
                          >
                            <span
                              className={`flex-1 ${row.depth === 0 ? 'font-medium' : ''}`}
                              style={{ paddingLeft: row.depth * 16 }}
                            >
                              {row.displayName}
                            </span>
                            <span className="ml-2 text-xs italic text-muted-foreground">
                              {row.rightLabel}
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
          <div className="flex items-center gap-4">
            {transaction.response && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isDeleting}
              >
                Delete
              </Button>
            )}
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

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
            <AlertDialogDescription>
              The transaction will return to its original state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Yes, delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
