'use client'

// Columna derecha. Bloques read-only + textarea con auto-save
// debounced. Comunica al padre cuando el textarea tiene foco para que
// la lista congele su filtro.

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type { PublicUncatsResponseItem } from '../api/public-uncats.api'
import { useSavePublicNote } from '../hooks/use-save-public-note'

const DEBOUNCE_MS = 800
const NOTE_LIMIT = 5000

export interface PuTransactionDetailProps {
  token: string
  transaction: PublicUncatsResponseItem | null
  onEditingChange: (editing: boolean) => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  currentIndex: number
  total: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function PuTransactionDetail({
  token,
  transaction,
  onEditingChange,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  currentIndex,
  total,
}: PuTransactionDetailProps) {
  const saveMutation = useSavePublicNote(token)
  const initialNote = transaction?.response?.client_note ?? ''
  const [note, setNote] = useState(initialNote)
  const [status, setStatus] = useState<SaveStatus>('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>(initialNote)
  const txnIdRef = useRef<string | null>(transaction?.id ?? null)

  // Reset cuando cambia la transacción seleccionada. Solo dependemos
  // de `transaction?.id`; el `client_note` se lee fresco dentro del
  // efecto, no como dependencia (queremos un único reset por cambio
  // de id, no por refetch del query).
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const next = transaction?.response?.client_note ?? ''
    setNote(next)
    lastSavedRef.current = next
    txnIdRef.current = transaction?.id ?? null
    setStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id])

  // Mantén lastSaved sincronizado si el query refetchea con un valor
  // nuevo del backend (otro tab del cliente actualizó). Excluimos
  // `note` adrede: no queremos disparar este efecto al teclear.
  useEffect(() => {
    if (!transaction) return
    const fromServer = transaction.response?.client_note ?? ''
    if (fromServer !== lastSavedRef.current && fromServer !== note) {
      lastSavedRef.current = fromServer
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction])

  const flush = () => {
    if (!txnIdRef.current) return
    const trimmed = note.trim()
    // No mandamos si el valor trimmed coincide con lo último guardado
    // — evita PATCHes inútiles cuando el cliente sale del textarea
    // sin tocar nada.
    if (trimmed === lastSavedRef.current.trim()) return
    const txnId = txnIdRef.current
    setStatus('saving')
    saveMutation.mutate(
      { txnId, note: trimmed },
      {
        onSuccess: () => {
          lastSavedRef.current = trimmed
          setStatus('saved')
        },
        onError: () => setStatus('error'),
      },
    )
  }

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNote(value)
    setStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(flush, DEBOUNCE_MS)
  }

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    flush()
    onEditingChange(false)
  }

  if (!transaction) {
    return (
      <p className="p-10 text-sm text-muted-foreground">
        Select a transaction to add notes.
      </p>
    )
  }

  return (
    <div className="flex flex-col p-8 md:p-10">
      {/* Top: badges + vendor + amount */}
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-6">
        <div className="flex flex-wrap gap-1.5">
          {transaction.category === 'uncategorized_income' ? (
            <span className="inline-flex items-center rounded border border-green-600/30 bg-green-600/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700">
              ↓ Income
            </span>
          ) : (
            <span className="inline-flex items-center rounded border border-red-600/30 bg-red-600/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700">
              ↑ Expense
            </span>
          )}
          {transaction.category === 'uncategorized_expense' && transaction.docnum && (
            <span className="inline-flex items-center rounded border bg-muted px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Check #{transaction.docnum}
            </span>
          )}
          <span className="inline-flex items-center rounded border border-amber-500 bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Uncategorized
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">
          {transaction.vendor_name ?? '—'}
        </h2>
        <p
          className={`text-4xl font-bold tabular-nums leading-none tracking-tight ${
            transaction.category === 'uncategorized_income'
              ? 'text-green-700'
              : 'text-red-700'
          }`}
        >
          {transaction.category === 'uncategorized_income' ? '+' : ''}${transaction.amount}
        </p>
      </div>

      {/* Meta grid */}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-6">
        <div className="hidden flex-col gap-1 md:flex">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            ID
          </dt>
          <dd className="font-mono text-sm">{transaction.id}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Date
          </dt>
          <dd className="font-mono text-sm">{transaction.txn_date}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Account
          </dt>
          <dd className="font-mono text-sm">{transaction.split_account ?? '—'}</dd>
        </div>
        <div className="hidden flex-col gap-1 md:flex">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Current category
          </dt>
          <dd className="text-sm text-red-700">
            {transaction.category === 'uncategorized_income'
              ? 'Uncategorized Income'
              : 'Uncategorized Expense'}
          </dd>
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Bank memo
          </dt>
          <dd className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground">
            {transaction.memo ?? '—'}
          </dd>
        </div>
      </dl>

      {/* Note */}
      <div className="flex flex-col gap-3 pt-6">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="pu-note"
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            Your note (the only thing you can edit)
          </Label>
          {/* Status badge — solo en mobile. */}
          {transaction.response !== null ? (
            <span className="inline-flex items-center rounded border border-green-600/30 bg-green-600/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700 md:hidden">
              Answered
            </span>
          ) : (
            <span className="inline-flex items-center rounded border border-red-600/30 bg-red-600/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700 md:hidden">
              Pending
            </span>
          )}
        </div>
        <Textarea
          id="pu-note"
          value={note}
          onChange={handleNoteChange}
          onFocus={() => onEditingChange(true)}
          onBlur={handleBlur}
          maxLength={NOTE_LIMIT}
          placeholder="What was this for? Be specific — vendor, purpose, project, person..."
          className="min-h-32 resize-none text-sm leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">
          {note.length}/{NOTE_LIMIT} ·{' '}
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && 'Saved'}
          {status === 'error' && 'Could not save. Try again.'}
          {status === 'idle' &&
            (lastSavedRef.current ? 'Saved' : 'Auto-saves when you stop typing.')}
        </p>
      </div>

      {/* Navegación entre transacciones — solo en mobile */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-200 pt-4 md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {currentIndex + 1} / {total}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
