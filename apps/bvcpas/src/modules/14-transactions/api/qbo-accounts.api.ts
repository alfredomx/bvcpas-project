// Carga las cuentas QBO de un cliente vía el proxy Intuit.
// D-bvcpas-044: usa el proxy genérico POST /v1/intuit/realms/{realmId}/call
// porque no hay endpoint dedicado. Tipos locales (no del SDK — el
// proxy devuelve `unknown`).

import { api } from '@/lib/api/client'

export interface QboAccount {
  Id: string
  Name: string
  AcctNum: string | null
  AccountType: string
  SubAccount: boolean
  ParentId: string | null
  FullyQualifiedName: string
}

interface RawQboAccount {
  Id?: unknown
  Name?: unknown
  AcctNum?: unknown
  AccountType?: unknown
  SubAccount?: unknown
  ParentRef?: { value?: unknown } | null
  FullyQualifiedName?: unknown
}

const QBO_ACCOUNT_QUERY =
  'select Id, Name, AcctNum, AccountType, SubAccount, ParentRef, ' +
  'FullyQualifiedName, Active from Account ' +
  'WHERE Active = true MAXRESULTS 1000'

export async function getQboAccounts(realmId: string): Promise<QboAccount[]> {
  const { data, error } = await api.POST('/v1/intuit/realms/{realmId}/call', {
    params: { path: { realmId } },
    body: {
      method: 'GET',
      path: `/company/${realmId}/query?query=${encodeURIComponent(QBO_ACCOUNT_QUERY)}`,
    },
  })
  if (error) throw error
  if (!data) return []

  const raw = data as { QueryResponse?: { Account?: unknown[] } }
  const accounts = raw.QueryResponse?.Account ?? []

  return accounts
    .filter((a): a is RawQboAccount => typeof a === 'object' && a !== null)
    .filter(
      (a) =>
        typeof a.Id === 'string' &&
        typeof a.Name === 'string' &&
        typeof a.FullyQualifiedName === 'string',
    )
    .map((a) => ({
      Id: a.Id as string,
      Name: a.Name as string,
      AcctNum:
        typeof a.AcctNum === 'string' && a.AcctNum.trim() !== ''
          ? a.AcctNum
          : null,
      AccountType: typeof a.AccountType === 'string' ? a.AccountType : '',
      SubAccount: a.SubAccount === true,
      ParentId:
        a.ParentRef && typeof a.ParentRef.value === 'string'
          ? a.ParentRef.value
          : null,
      FullyQualifiedName: a.FullyQualifiedName as string,
    }))
}
