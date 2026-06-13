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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type {
  BankAccount,
  CreateBankAccountBody,
  UpdateBankAccountBody,
} from '../api/bank-accounts.api'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL } from '../lib/account-types'
import { useCreateBankAccount } from '../hooks/use-create-bank-account'
import { useUpdateBankAccount } from '../hooks/use-update-bank-account'

const schema = z.object({
  accountMask: z
    .string()
    .regex(/^\d{4}$/, 'Must be exactly 4 digits'),
  accountType: z.enum([
    'checking',
    'savings',
    'credit_card',
    'loan',
    'other',
  ]),
  label: z.string().max(200).optional(),
  status: z.enum(['active', 'blocked', 'closed']).default('active'),
  notes: z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof schema>

export interface BankAccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credentialId: string
  account: BankAccount | null
}

export function BankAccountFormDialog({
  open,
  onOpenChange,
  credentialId,
  account,
}: BankAccountFormDialogProps) {
  const createMutation = useCreateBankAccount()
  const updateMutation = useUpdateBankAccount()
  const isEdit = account !== null
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountMask: '',
      accountType: 'checking',
      label: '',
      status: 'active',
      notes: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && account) {
      form.reset({
        accountMask: account.account_mask,
        accountType: account.account_type,
        label: account.label ?? '',
        status: account.status,
        notes: account.notes ?? '',
      })
    } else {
      form.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id])

  const onSubmit = (values: FormValues) => {
    if (isEdit && account) {
      const body: UpdateBankAccountBody = {
        accountMask: values.accountMask,
        accountType: values.accountType,
        label: values.label || null,
        status: values.status,
        notes: values.notes || null,
      }
      updateMutation.mutate(
        { accountId: account.id, body },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      const body: CreateBankAccountBody = {
        accountMask: values.accountMask,
        accountType: values.accountType,
        label: values.label || undefined,
        status: values.status,
        notes: values.notes || undefined,
      }
      createMutation.mutate(
        { credentialId, body },
        { onSuccess: () => onOpenChange(false) },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit account' : 'Add account'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details of this bank account.'
              : 'Add an individual account inside this login (checking, savings, credit card, etc.).'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accountMask">Mask (last 4)</Label>
              <Input
                id="accountMask"
                maxLength={4}
                placeholder="1234"
                {...form.register('accountMask')}
              />
              {form.formState.errors.accountMask && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.accountMask.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select
                value={form.watch('accountType')}
                onValueChange={(v) =>
                  form.setValue('accountType', v as FormValues['accountType'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Label (optional)</Label>
            <Input
              id="label"
              placeholder="e.g. Primary checking"
              {...form.register('label')}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) =>
                  form.setValue('status', v as FormValues['status'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" {...form.register('notes')} />
            </div>
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
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
