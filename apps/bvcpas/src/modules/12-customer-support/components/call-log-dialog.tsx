'use client'

// Dialog para registrar y editar llamadas de un cliente.
// Split-pane: form a la izquierda + lista a la derecha. Click en una
// fila de la lista carga ese log en modo edit. Tras submit/delete,
// el form vuelve a modo create para registrar la siguiente llamada
// sin cerrar el dialog.

import { useEffect, useState } from 'react'
import { CalendarClock, Pencil, Phone, PlusCircle, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

import type { CallLog, CallOutcome } from '../api/call-logs.api'
import {
  useCallLogs,
  useCreateCallLog,
  useDeleteCallLog,
  useUpdateCallLog,
} from '../hooks/use-call-logs'
import { formatRelativeShort } from '../lib/format'

export interface CallLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
}

const OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'responded', label: 'Responded' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'refused', label: 'Refused' },
  { value: 'other', label: 'Other' },
]

const OUTCOME_BADGE: Record<CallOutcome, string> = {
  responded:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  no_answer:
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  voicemail:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  refused: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  other:
    'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
}

const NOTES_LIMIT = 2000

function outcomeLabel(o: CallOutcome): string {
  return OUTCOMES.find((x) => x.value === o)?.label ?? o
}

function toLocalDatetimeInput(iso: string): string {
  // <input type="datetime-local"> espera "YYYY-MM-DDTHH:mm" en hora local.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalDatetimeInput(value: string): string {
  // El input ya emite hora local; new Date(value) la interpreta como local.
  return new Date(value).toISOString()
}

function formatWhenLong(iso: string | null): string {
  // Etiqueta amigable arriba del Adjust: "Today, 03:42 PM" o
  // "Apr 12, 2026 · 09:00 AM" para llamadas con fecha antigua.
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return 'Now'
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
  if (sameDay) return `Today, ${time}`
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d)
  return `${date} · ${time}`
}

export function CallLogDialog({
  open,
  onOpenChange,
  clientId,
}: CallLogDialogProps) {
  const { data, isLoading } = useCallLogs(clientId)
  const createMutation = useCreateCallLog(clientId)
  const updateMutation = useUpdateCallLog(clientId)
  const deleteMutation = useDeleteCallLog(clientId)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<CallOutcome>('responded')
  const [notes, setNotes] = useState('')
  const [calledAt, setCalledAt] = useState<string>('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const resetForm = () => {
    setEditingId(null)
    setOutcome('responded')
    setNotes('')
    setCalledAt('')
    setAdjustOpen(false)
  }

  // Reset al abrir el dialog (no al cambiar `data`, para no perder lo
  // que el usuario esté escribiendo cuando la lista se refresca).
  useEffect(() => {
    if (open) resetForm()
  }, [open])

  const loadForEdit = (log: CallLog) => {
    setEditingId(log.id)
    setOutcome(log.outcome)
    setNotes(log.notes ?? '')
    setCalledAt(log.called_at)
    setAdjustOpen(false)
  }

  const handleSave = () => {
    const body = {
      outcome,
      notes: notes.trim() === '' ? undefined : notes.trim(),
      called_at: calledAt || undefined,
    }
    if (editingId) {
      updateMutation.mutate(
        { logId: editingId, body: { ...body, notes: body.notes ?? null } },
        {
          onSuccess: () => {
            toast.success('Call updated.')
            resetForm()
          },
          onError: () => toast.error('Could not update call.'),
        },
      )
    } else {
      createMutation.mutate(body, {
        onSuccess: () => {
          toast.success('Call logged.')
          resetForm()
        },
        onError: () => toast.error('Could not log call.'),
      })
    }
  }

  const handleDelete = () => {
    if (!editingId) return
    deleteMutation.mutate(editingId, {
      onSuccess: () => {
        toast.success('Call deleted.')
        setDeleteConfirmOpen(false)
        resetForm()
      },
      onError: () => {
        toast.error('Could not delete call.')
        setDeleteConfirmOpen(false)
      },
    })
  }

  const isEdit = editingId !== null
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const items = data?.items ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4 text-muted-foreground" />
            {isEdit ? 'Edit call' : 'Log a call'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-5">
          {/* Form */}
          <section className="flex flex-col gap-5 md:col-span-2">
            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                When
              </Label>
              {adjustOpen ? (
                <Input
                  type="datetime-local"
                  value={toLocalDatetimeInput(calledAt || new Date().toISOString())}
                  onChange={(e) =>
                    setCalledAt(fromLocalDatetimeInput(e.target.value))
                  }
                  onBlur={() => setAdjustOpen(false)}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!calledAt) setCalledAt(new Date().toISOString())
                    setAdjustOpen(true)
                  }}
                  className="group flex w-fit items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <span>{formatWhenLong(calledAt || null)}</span>
                  <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="call-outcome"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Outcome
              </Label>
              <Select
                value={outcome}
                onValueChange={(v) => setOutcome(v as CallOutcome)}
              >
                <SelectTrigger id="call-outcome" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <Label
                  htmlFor="call-notes"
                  className="text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Notes
                </Label>
                <span className="text-xs text-muted-foreground">
                  {notes.length}/{NOTES_LIMIT}
                </span>
              </div>
              <Textarea
                id="call-notes"
                placeholder="What did you talk about?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={NOTES_LIMIT}
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-4">
              <div>
                {isEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={isPending}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    disabled={isPending}
                  >
                    New call
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Log call'}
                </Button>
              </div>
            </div>
          </section>

          {/* Lista */}
          <section className="flex flex-col gap-3 border-t pt-4 md:col-span-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                History
              </p>
              {isEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <PlusCircle className="size-3.5" />
                  New call
                </Button>
              )}
            </div>

            <div className="max-h-210 overflow-y-auto pr-1">
              {isLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Phone className="size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No calls logged yet.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {items.map((log) => {
                    const selected = log.id === editingId
                    return (
                      <li key={log.id}>
                        <button
                          type="button"
                          onClick={() => loadForEdit(log)}
                          className={`flex w-full flex-col gap-1.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
                            selected
                              ? 'border-foreground bg-accent'
                              : 'border-border/50 hover:border-border hover:bg-accent/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {formatRelativeShort(log.called_at)}
                            </span>
                            <Badge
                              variant="secondary"
                              className={OUTCOME_BADGE[log.outcome]}
                            >
                              {outcomeLabel(log.outcome)}
                            </Badge>
                          </div>
                          {log.notes ? (
                            <p className="line-clamp-2 text-sm">{log.notes}</p>
                          ) : (
                            <p className="text-xs italic text-muted-foreground/70">
                              No notes
                            </p>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this call?</AlertDialogTitle>
              <AlertDialogDescription>
                The entry will be removed permanently. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  handleDelete()
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
