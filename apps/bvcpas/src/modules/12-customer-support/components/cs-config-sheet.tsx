'use client'

// Sheet lateral derecho con los 5 settings que afectan el envío de
// follow-ups al cliente. Primera implementación del patrón
// D-bvcpas-033 (settings por pestaña).

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { useUpdateClient } from '@/modules/11-clients/hooks/use-update-client'
import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

export interface CsConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: UncatsDetailResponse['client']
}

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Enter a valid email or leave empty.',
  })

const schema = z.object({
  primaryContactName: z.string().trim().max(120),
  primaryContactEmail: optionalEmail,
  ccEmail: optionalEmail,
  transactionsFilter: z.enum(['all', 'income', 'expense']),
  draftEmailEnabled: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function CsConfigSheet({ open, onOpenChange, client }: CsConfigSheetProps) {
  const update = useUpdateClient(client.id)

  const defaultValues: FormValues = {
    primaryContactName: client.primary_contact_name ?? '',
    primaryContactEmail: client.primary_contact_email ?? '',
    ccEmail: client.cc_email ?? '',
    transactionsFilter: client.transactions_filter,
    draftEmailEnabled: client.draft_email_enabled,
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Re-llenar el form cuando el sheet abre con datos nuevos del cliente.
  useEffect(() => {
    if (open) {
      reset(defaultValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client.id])

  const onSubmit = handleSubmit((values) => {
    update.mutate(
      {
        primaryContactName: emptyToNull(values.primaryContactName),
        primaryContactEmail: emptyToNull(values.primaryContactEmail),
        ccEmail: emptyToNull(values.ccEmail),
        transactionsFilter: values.transactionsFilter,
        draftEmailEnabled: values.draftEmailEnabled,
      },
      {
        onSuccess: () => {
          toast.success('Settings saved.')
          onOpenChange(false)
        },
        onError: () => {
          toast.error('Could not save settings. Try again.')
        },
      },
    )
  })

  const filterValue = watch('transactionsFilter')
  const draftValue = watch('draftEmailEnabled')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Configure</SheetTitle>
            <SheetDescription>
              Settings that affect the follow-up email sent to this client.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primaryContactName">Contact name</Label>
              <Input id="primaryContactName" {...register('primaryContactName')} />
              {errors.primaryContactName && (
                <p className="text-xs text-destructive">{errors.primaryContactName.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primaryContactEmail">Contact email</Label>
              <Input
                id="primaryContactEmail"
                inputMode="email"
                {...register('primaryContactEmail')}
              />
              {errors.primaryContactEmail && (
                <p className="text-xs text-destructive">{errors.primaryContactEmail.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ccEmail">CC email</Label>
              <Input id="ccEmail" inputMode="email" {...register('ccEmail')} />
              {errors.ccEmail && (
                <p className="text-xs text-destructive">{errors.ccEmail.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Transactions filter</Label>
              <RadioGroup
                value={filterValue}
                onValueChange={(v) =>
                  setValue('transactionsFilter', v as FormValues['transactionsFilter'], {
                    shouldDirty: true,
                  })
                }
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="filter-all" />
                  <Label htmlFor="filter-all" className="font-normal">
                    All (expense + income)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="expense" id="filter-expense" />
                  <Label htmlFor="filter-expense" className="font-normal">
                    Expense only
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="income" id="filter-income" />
                  <Label htmlFor="filter-income" className="font-normal">
                    Income only
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="draftEmailEnabled">Draft email on sync</Label>
                <p className="text-xs text-muted-foreground">
                  Generates an Outlook draft when transactions are synced.
                </p>
              </div>
              <Switch
                id="draftEmailEnabled"
                checked={draftValue}
                onCheckedChange={(v) =>
                  setValue('draftEmailEnabled', v, { shouldDirty: true })
                }
              />
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
