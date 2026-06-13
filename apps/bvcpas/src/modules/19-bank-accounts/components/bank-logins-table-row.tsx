'use client'

import { Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { BankLogin } from '../api/bank-accounts.api'
import { LOGIN_STATUS } from '../lib/status-labels'

import { StatusPill } from './status-pill'

export interface BankLoginsTableRowProps {
  login: BankLogin
  onSelect: (login: BankLogin) => void
  onEdit: (login: BankLogin) => void
  onDelete: (login: BankLogin) => void
}

export function BankLoginsTableRow({
  login,
  onSelect,
  onEdit,
  onDelete,
}: BankLoginsTableRowProps) {
  return (
    <tr
      className="cursor-pointer border-t hover:bg-accent/30"
      onClick={() => onSelect(login)}
    >
      <td className="px-3 py-2 text-sm">{login.client.legal_name}</td>
      <td className="px-3 py-2 text-sm">
        <div className="flex flex-col">
          <span>{login.portal.name}</span>
          {login.portal.portal_url && (
            <span className="font-mono text-xs text-muted-foreground">
              {login.portal.portal_url}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <StatusPill status={LOGIN_STATUS[login.status]} />
      </td>
      <td className="max-w-[280px] truncate px-3 py-2 text-xs text-muted-foreground">
        {login.notes ?? '—'}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {new Date(login.updated_at).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Edit"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(login)
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Delete"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(login)
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
