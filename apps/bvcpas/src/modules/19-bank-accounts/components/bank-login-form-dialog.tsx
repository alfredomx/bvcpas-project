'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { useClients } from '@/modules/11-clients/hooks/use-clients'

import type {
  BankLogin,
  CreateBankLoginBody,
} from '../api/bank-accounts.api'
import { useBankPortals } from '../hooks/use-bank-portals'
import { useCreateBankLogin } from '../hooks/use-create-bank-login'
import { useUpdateBankLogin } from '../hooks/use-update-bank-login'

const createSchema = z.object({
  clientId: z.string().uuid({ message: 'Select a client' }),
  bankPortalId: z.string().uuid({ message: 'Select a portal' }),
  username: z.string().min(1, 'Required').max(200),
  password: z.string().min(1, 'Required').max(500),
  securityQa: z.string().max(2000).optional(),
  status: z.enum(['active', 'blocked', 'closed']).default('active'),
  notes: z.string().max(2000).optional(),
})

const editSchema = z.object({
  username: z.string().max(200).optional(),
  password: z.string().max(500).optional(),
  securityQa: z.string().max(2000).optional(),
  status: z.enum(['active', 'blocked', 'closed']).optional(),
  notes: z.string().max(2000).optional(),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

export interface BankLoginFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // null = create mode; object = edit mode
  login: BankLogin | null
}

export function BankLoginFormDialog({
  open,
  onOpenChange,
  login,
}: BankLoginFormDialogProps) {
  const isEdit = login !== null

  if (isEdit) {
    return (
      <EditDialog open={open} onOpenChange={onOpenChange} login={login!} />
    )
  }
  return <CreateDialog open={open} onOpenChange={onOpenChange} />
}

function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createMutation = useCreateBankLogin()
  const { items: clients } = useClients()
  const portalsQuery = useBankPortals()
  const portals = portalsQuery.data?.data ?? []
  const [clientOpen, setClientOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      clientId: '',
      bankPortalId: '',
      username: '',
      password: '',
      securityQa: '',
      status: 'active',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) form.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = (values: CreateFormValues) => {
    const body: CreateBankLoginBody = {
      clientId: values.clientId,
      bankPortalId: values.bankPortalId,
      username: values.username,
      password: values.password,
      securityQa: values.securityQa || undefined,
      status: values.status,
      notes: values.notes || undefined,
    }
    createMutation.mutate(body, {
      onSuccess: () => onOpenChange(false),
    })
  }

  const selectedClient = clients.find((c) => c.id === form.watch('clientId'))
  const selectedPortal = portals.find((p) => p.id === form.watch('bankPortalId'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add bank login</DialogTitle>
          <DialogDescription>
            Store the portal credentials for a client. The password is encrypted
            and never shown again after saving.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label>Client</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-between"
                >
                  {selectedClient?.legal_name ?? 'Select a client…'}
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search client…" />
                  <CommandList>
                    <CommandEmpty>No clients found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.legal_name}
                          onSelect={() => {
                            form.setValue('clientId', c.id, {
                              shouldValidate: true,
                            })
                            setClientOpen(false)
                          }}
                        >
                          <Check
                            className={`mr-2 size-4 ${form.watch('clientId') === c.id ? 'opacity-100' : 'opacity-0'}`}
                          />
                          {c.legal_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {form.formState.errors.clientId && (
              <p className="text-xs text-red-600">
                {form.formState.errors.clientId.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Portal</Label>
            <Popover open={portalOpen} onOpenChange={setPortalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-between"
                  disabled={portalsQuery.isLoading}
                >
                  {selectedPortal?.name ??
                    (portalsQuery.isLoading
                      ? 'Loading portals…'
                      : 'Select a portal…')}
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search portal…" />
                  <CommandList>
                    <CommandEmpty>No portals found.</CommandEmpty>
                    <CommandGroup>
                      {portals.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            form.setValue('bankPortalId', p.id, {
                              shouldValidate: true,
                            })
                            setPortalOpen(false)
                          }}
                        >
                          <Check
                            className={`mr-2 size-4 ${form.watch('bankPortalId') === p.id ? 'opacity-100' : 'opacity-0'}`}
                          />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {form.formState.errors.bankPortalId && (
              <p className="text-xs text-red-600">
                {form.formState.errors.bankPortalId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...form.register('username')} />
              {form.formState.errors.username && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="securityQa">Security Q&amp;A (optional)</Label>
            <Textarea
              id="securityQa"
              rows={2}
              {...form.register('securityQa')}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) =>
                  form.setValue('status', v as CreateFormValues['status'])
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
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save login'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({
  open,
  onOpenChange,
  login,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  login: BankLogin
}) {
  const updateMutation = useUpdateBankLogin()

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      username: '',
      password: '',
      securityQa: '',
      status: login.status,
      notes: login.notes ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        username: '',
        password: '',
        securityQa: '',
        status: login.status,
        notes: login.notes ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, login.id])

  const onSubmit = (values: EditFormValues) => {
    // Construyo el body solo con los campos llenos: el operador edita
    // sin ver el actual; campos vacíos NO se mandan.
    const body: Record<string, unknown> = {}
    if (values.username) body.username = values.username
    if (values.password) body.password = values.password
    if (values.securityQa) body.securityQa = values.securityQa
    if (values.status && values.status !== login.status) body.status = values.status
    if (values.notes !== undefined && values.notes !== (login.notes ?? '')) {
      body.notes = values.notes || null
    }

    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }

    updateMutation.mutate(
      { credentialId: login.id, body: body as never },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit bank login</DialogTitle>
          <DialogDescription>
            {login.client.legal_name} · {login.portal.name}. Leave a field empty
            to keep the current value. Password is never shown.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">New username</Label>
              <Input
                id="username"
                placeholder="(keep current)"
                {...form.register('username')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="(keep current)"
                {...form.register('password')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="securityQa">New security Q&amp;A</Label>
            <Textarea
              id="securityQa"
              rows={2}
              placeholder="(keep current)"
              {...form.register('securityQa')}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch('status') ?? login.status}
                onValueChange={(v) =>
                  form.setValue('status', v as EditFormValues['status'])
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
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
