'use client'

import { ChevronDown, ExternalLink, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

import type { BankLogin } from '../api/bank-accounts.api'
import { useBankLoginAccounts } from '../hooks/use-bank-login-accounts'
import { ACCOUNT_TYPE_LABEL } from '../lib/account-types'
import { LOGIN_STATUS } from '../lib/status-labels'

import { CredentialSecretField } from './credential-secret-field'
import { StatusPill } from './status-pill'

export interface CredentialCardProps {
  login: BankLogin
  onOpenAccounts: (login: BankLogin) => void
  onEdit: (login: BankLogin) => void
  onDelete: (login: BankLogin) => void
}

const fieldLabel = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'

export function CredentialCard({ login, onOpenAccounts, onEdit, onDelete }: CredentialCardProps) {
  const accountsQuery = useBankLoginAccounts(login.id)
  const accounts = accountsQuery.data?.data ?? []

  const accountsLabel = accountsQuery.isLoading
    ? 'Loading…'
    : accounts.length === 0
      ? 'No accounts'
      : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{login.portal.name}</span>
            <StatusPill status={LOGIN_STATUS[login.status]} />
          </div>
          {login.portal.portal_url && (
            <a
              href={login.portal.portal_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
            >
              <span className="truncate">{login.portal.portal_url}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Edit login"
            onClick={() => onEdit(login)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Delete login"
            className="text-destructive"
            onClick={() => onDelete(login)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-3">
        {/* Fila 1 */}
        <CredentialSecretField label="Username" value={login.username} />
        <CredentialSecretField label="Password" value={login.password} secret />
        <div className="flex min-w-0 flex-col gap-1">
          <span className={fieldLabel}>Accounts</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-8 w-full justify-between px-3 text-xs font-normal"
                aria-label="Accounts"
              >
                <span className="truncate">{accountsLabel}</span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {accounts.length === 0 ? (
                <DropdownMenuItem disabled className="text-xs">
                  No accounts yet
                </DropdownMenuItem>
              ) : (
                accounts.map((acc) => (
                  <DropdownMenuItem
                    key={acc.id}
                    className="text-xs"
                    onClick={() => onOpenAccounts(login)}
                  >
                    ····{acc.account_mask} · {ACCOUNT_TYPE_LABEL[acc.account_type]}
                    {acc.label ? ` · ${acc.label}` : ''}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={() => onOpenAccounts(login)}>
                Manage accounts…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Fila 2: Q&A abarca Username+Password; Notes alineado con Accounts */}
        <div className="min-w-0 sm:col-span-2">
          <CredentialSecretField label="Security Q&A" value={login.security_qa} secret wrap />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={fieldLabel}>Notes</span>
          <Input
            readOnly
            value={login.notes ?? ''}
            placeholder="No notes"
            className="h-8 text-sm"
            aria-label="Notes"
          />
        </div>
      </div>
    </div>
  )
}
