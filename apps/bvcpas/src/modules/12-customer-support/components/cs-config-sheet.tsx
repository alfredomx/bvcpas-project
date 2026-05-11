'use client'

// Sheet lateral derecho con los 5 settings que afectan el envío de
// follow-ups al cliente. Primera implementación del patrón
// D-bvcpas-033 (settings por pestaña).

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'

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

import {
  createPublicLink,
  revokePublicLink,
  updatePublicLink,
} from '../api/public-links.api'

export interface CsConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: UncatsDetailResponse['client']
  publicLink: UncatsDetailResponse['public_link']
}

// Validación + normalización de emails CSV (D-bvcpas-039, D-bvcpas-040).
// Acepta uno o más correos separados por coma. Vacío → null.
// Resultado: null o string normalizado "email1, email2".

const SIMPLE_EMAIL_REGEX = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

const csvEmailString = z
  .string()
  .transform((s) => {
    const trimmed = s.trim()
    if (trimmed === '') return null
    return trimmed
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .join(', ')
  })
  .refine(
    (s) => {
      if (s === null) return true
      const parts = s.split(',').map((e) => e.trim()).filter((e) => e.length > 0)
      return parts.length > 0 && parts.every((e) => SIMPLE_EMAIL_REGEX.test(e))
    },
    { message: 'Debe ser uno o más correos válidos separados por coma' },
  )

// Texto opcional → null si vacío. Para mantener consistencia con
// el backend (`primary_contact_name: string | null`).
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => {
      const trimmed = s.trim()
      return trimmed === '' ? null : trimmed
    })

const schema = z.object({
  primaryContactName: optionalText(120),
  primaryContactEmail: csvEmailString,
  ccEmail: csvEmailString,
  transactionsFilter: z.enum(['all', 'income', 'expense']),
  draftEmailEnabled: z.boolean(),
})

// Form trabaja con strings (input del usuario); submit recibe el
// output del transform (string | null).
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function CsConfigSheet({
  open,
  onOpenChange,
  client,
  publicLink,
}: CsConfigSheetProps) {
  const update = useUpdateClient(client.id)
  const queryClient = useQueryClient()

  const invalidateDetail = () => {
    // Invalidamos cualquier query que empiece con 'uncats-detail' (la key real
    // del hook es ['uncats-detail', clientId, from, to]; usar solo el prefijo
    // garantiza match aunque el clientId de la URL difiera del id que mapi
    // devuelve, ej. por formato).
    queryClient.invalidateQueries({ queryKey: ['uncats-detail'] })
  }

  const createMutation = useMutation({
    mutationFn: (opts?: { force?: boolean }) =>
      createPublicLink(client.id, { force: opts?.force }),
    onSuccess: () => invalidateDetail(),
  })

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => revokePublicLink(client.id, linkId),
    onSuccess: () => invalidateDetail(),
  })

  const unrevokeMutation = useMutation({
    mutationFn: (linkId: string) =>
      updatePublicLink(client.id, linkId, { revokedAt: null }),
    onSuccess: () => invalidateDetail(),
  })

  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [regenDialogOpen, setRegenDialogOpen] = useState(false)

  const hasPublicLink = publicLink !== null
  const isLinkEnabled = hasPublicLink && publicLink!.revoked_at === null

  const handleGenerate = () => {
    createMutation.mutate(undefined, {
      onError: () => toast.error('Could not generate link.'),
    })
  }

  const handleSwitchChange = (checked: boolean) => {
    if (!publicLink) return
    if (checked && !isLinkEnabled) {
      // OFF (revocado) → ON: PATCH revokedAt:null.
      unrevokeMutation.mutate(publicLink.id, {
        onError: () => toast.error('Could not enable link.'),
      })
    } else if (!checked && isLinkEnabled) {
      // ON → OFF: pedir confirm.
      setRevokeDialogOpen(true)
    }
  }

  const confirmRevoke = () => {
    if (!publicLink) return
    revokeMutation.mutate(publicLink.id, {
      onSuccess: () => {
        setRevokeDialogOpen(false)
      },
      onError: () => {
        toast.error('Could not disable link.')
        setRevokeDialogOpen(false)
      },
    })
  }

  const confirmRegenerate = () => {
    createMutation.mutate(
      { force: true },
      {
        onSuccess: () => {
          setRegenDialogOpen(false)
        },
        onError: () => {
          toast.error('Could not regenerate link.')
          setRegenDialogOpen(false)
        },
      },
    )
  }

  const handleCopy = async () => {
    if (!publicLink) return
    try {
      await navigator.clipboard.writeText(publicLink.url)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy.')
    }
  }

  const formattedCreatedAt = publicLink
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
        new Date(publicLink.created_at),
      )
    : ''

  const defaultValues: FormInput = {
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
  } = useForm<FormInput, unknown, FormOutput>({
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
    // values ya viene transformado por zod: name/emails son string|null
    // y la normalización CSV ya está aplicada.
    update.mutate(
      {
        primaryContactName: values.primaryContactName,
        primaryContactEmail: values.primaryContactEmail,
        ccEmail: values.ccEmail,
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
          </SheetHeader>
          

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 border-t">
            <div className="flex flex-col gap-1">
              <Label>Follow-up</Label>
              <p className="text-xs text-muted-foreground">
                Settings that affect the follow-up email sent to this client.
              </p>
            </div>

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
                  setValue('transactionsFilter', v as FormInput['transactionsFilter'], {
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

            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-col gap-1.5">
                <Label>Public link</Label>
                <p className="text-xs text-muted-foreground">
                  Shareable URL the client uses to view and categorize their
                  uncats without logging in.
                </p>
              </div>
              
              {hasPublicLink && (
                <p className="text-xs text-muted-foreground">
                  Created {formattedCreatedAt}
                </p>
              )}

              <div className="flex items-center gap-1.5">
                <Input
                  readOnly
                  value={publicLink?.url ?? ''}
                  aria-label="Public link URL"
                  className="font-mono text-xs"
                  placeholder="No link generated yet"
                />
                {hasPublicLink && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                  >
                    Copy
                  </Button>
                )}
              </div>

              {hasPublicLink && (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="publicLinkEnabled" className="font-normal">
                    Enabled
                  </Label>
                  <Switch
                    id="publicLinkEnabled"
                    checked={isLinkEnabled}
                    disabled={
                      revokeMutation.isPending || unrevokeMutation.isPending
                    }
                    onCheckedChange={handleSwitchChange}
                  />
                </div>
              )}

              <div className="flex justify-end pt-1">
                {hasPublicLink ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRegenDialogOpen(true)}
                    disabled={createMutation.isPending}
                  >
                    Regenerate
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Generating…' : 'Generate'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable public link?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current URL will stop working immediately. The client will
                  no longer be able to access their uncats.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={revokeMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    confirmRevoke()
                  }}
                  disabled={revokeMutation.isPending}
                >
                  {revokeMutation.isPending ? 'Disabling…' : 'Disable'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate link?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current URL will stop working immediately. A new URL will
                  be generated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={createMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    confirmRegenerate()
                  }}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Regenerating…' : 'Regenerate'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
