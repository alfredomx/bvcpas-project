'use client'

import { useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import type {
  BankAccount,
  BankLogin,
} from '../api/bank-accounts.api'
import { useBankLoginAccounts } from '../hooks/use-bank-login-accounts'
import { ACCOUNT_TYPE_LABEL } from '../lib/account-types'
import { ACCOUNT_STATUS, LOGIN_STATUS } from '../lib/status-labels'

import { BankAccountFormDialog } from './bank-account-form-dialog'
import { DeleteBankAccountDialog } from './delete-bank-account-dialog'
import { StatusPill } from './status-pill'

export interface BankLoginSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  login: BankLogin | null
  onEditLogin: (login: BankLogin) => void
  onDeleteLogin: (login: BankLogin) => void
}

export function BankLoginSheet({
  open,
  onOpenChange,
  login,
  onEditLogin,
  onDeleteLogin,
}: BankLoginSheetProps) {
  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [accountForEdit, setAccountForEdit] = useState<BankAccount | null>(null)
  const [accountForDelete, setAccountForDelete] = useState<BankAccount | null>(
    null,
  )

  const accountsQuery = useBankLoginAccounts(login?.id ?? null)
  const accounts = accountsQuery.data?.data ?? []

  if (!login) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-[720px] sm:max-w-[720px] p-0"
        >
          <SheetHeader className="gap-3 border-b p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <SheetTitle className="text-lg">{login.portal.name}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {login.client.legal_name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusPill status={LOGIN_STATUS[login.status]} />
                  {login.portal.portal_url && (
                    <a
                      href={login.portal.portal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {login.portal.portal_url}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditLogin(login)}
                >
                  <Pencil className="size-3.5" />
                  Edit login
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onDeleteLogin(login)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Accounts inside this login</h3>
                <p className="text-xs text-muted-foreground">
                  Individual checking, savings, credit-card, etc.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setAccountForEdit(null)
                  setAccountFormOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add account
              </Button>
            </div>

            <div className="mt-3 overflow-hidden rounded-md border">
              <table className="w-full text-left">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Mask
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Type
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Label
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {accountsQuery.isLoading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!accountsQuery.isLoading && accounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No accounts yet. Click &ldquo;Add account&rdquo; to
                        register one.
                      </td>
                    </tr>
                  )}
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-sm">····{acc.account_mask}</td>
                      <td className="px-3 py-2 text-sm">{ACCOUNT_TYPE_LABEL[acc.account_type]}</td>
                      <td className="px-3 py-2 text-sm">{acc.label ?? '—'}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={ACCOUNT_STATUS[acc.status]} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Edit account"
                            onClick={() => {
                              setAccountForEdit(acc)
                              setAccountFormOpen(true)
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Delete account"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setAccountForDelete(acc)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {login.notes && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Notes</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {login.notes}
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <BankAccountFormDialog
        open={accountFormOpen}
        onOpenChange={setAccountFormOpen}
        credentialId={login.id}
        account={accountForEdit}
      />

      <DeleteBankAccountDialog
        open={accountForDelete !== null}
        onOpenChange={(o) => {
          if (!o) setAccountForDelete(null)
        }}
        account={accountForDelete}
      />
    </>
  )
}
