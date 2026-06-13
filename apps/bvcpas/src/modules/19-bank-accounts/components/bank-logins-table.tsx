'use client'

import type { BankLogin } from '../api/bank-accounts.api'

import { BankLoginsTableRow } from './bank-logins-table-row'

export interface BankLoginsTableProps {
  logins: BankLogin[]
  onSelect: (login: BankLogin) => void
  onEdit: (login: BankLogin) => void
  onDelete: (login: BankLogin) => void
}

export function BankLoginsTable({
  logins,
  onSelect,
  onEdit,
  onDelete,
}: BankLoginsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-left">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Client
            </th>
            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Portal
            </th>
            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </th>
            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Updated
            </th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {logins.map((login) => (
            <BankLoginsTableRow
              key={login.id}
              login={login}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
