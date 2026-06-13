'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type {
  BankPortal,
  CreateBankPortalBody,
  UpdateBankPortalBody,
} from '../api/bank-accounts.api'
import { useCreateBankPortal } from '../hooks/use-create-bank-portal'
import { useUpdateBankPortal } from '../hooks/use-update-bank-portal'

const schema = z.object({
  name: z.string().min(1, 'Required').max(200),
  portalUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), 'Must be a valid URL (http/https)'),
})

type FormValues = z.infer<typeof schema>

export interface BankPortalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // null = crear; objeto = editar
  portal: BankPortal | null
}

export function BankPortalFormDialog({ open, onOpenChange, portal }: BankPortalFormDialogProps) {
  const isEdit = portal !== null
  const createMutation = useCreateBankPortal()
  const updateMutation = useUpdateBankPortal()
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', portalUrl: '' },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: portal?.name ?? '',
      portalUrl: portal?.portal_url ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portal?.id])

  const onSubmit = (values: FormValues) => {
    if (isEdit && portal) {
      const body: UpdateBankPortalBody = {
        name: values.name,
        portalUrl: values.portalUrl || null,
      }
      updateMutation.mutate({ portalId: portal.id, body }, { onSuccess: () => onOpenChange(false) })
    } else {
      const body: CreateBankPortalBody = {
        name: values.name,
        portalUrl: values.portalUrl || null,
      }
      createMutation.mutate(body, {
        onSuccess: () => onOpenChange(false),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit portal' : 'Add portal'}</DialogTitle>
          <DialogDescription>
            A portal is any login provider — bank, utility, payroll, etc. It becomes selectable when
            adding a login for a client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="portalName">Name</Label>
            <Input
              id="portalName"
              placeholder="e.g. Chase, City Water, Gusto…"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="portalUrl">Portal URL (optional)</Label>
            <Input id="portalUrl" placeholder="https://…" {...form.register('portalUrl')} />
            {form.formState.errors.portalUrl && (
              <p className="text-xs text-destructive">{form.formState.errors.portalUrl.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add portal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
