// Construye una lista plana de cuentas QBO con metadata jerárquica
// (depth + label "Sub of <padre>") a partir del array crudo.
//
// Las raíces se ordenan por FullyQualifiedName ascendente
// (case-insensitive), lo que garantiza que cada subcuenta quede
// inmediatamente debajo de su padre directo.

import type { QboAccount } from '../api/qbo-accounts.api'

export interface AccountRow {
  Id: string
  displayName: string
  depth: number
  rightLabel: string
  searchText: string
  AccountType: string
}

export function buildAccountTree(accounts: QboAccount[]): AccountRow[] {
  const byId = new Map<string, QboAccount>()
  for (const a of accounts) byId.set(a.Id, a)

  const sorted = [...accounts].sort((a, b) =>
    a.FullyQualifiedName.toLowerCase().localeCompare(
      b.FullyQualifiedName.toLowerCase(),
    ),
  )

  return sorted.map((a) => {
    const depth = a.FullyQualifiedName.split(':').length - 1
    const parent = a.ParentId ? byId.get(a.ParentId) : undefined
    const parentName =
      parent?.Name ??
      (depth > 0
        ? a.FullyQualifiedName.split(':').slice(-2, -1)[0] ?? ''
        : '')

    const rightLabel = depth === 0 ? a.AccountType : `Sub of ${parentName}`
    const displayName = a.AcctNum ? `${a.AcctNum} ${a.Name}` : a.Name
    const searchText =
      `${a.FullyQualifiedName} ${a.AcctNum ?? ''}`.toLowerCase().trim()

    return {
      Id: a.Id,
      displayName,
      depth,
      rightLabel,
      searchText,
      AccountType: a.AccountType,
    }
  })
}
