// Carga las cuentas QBO de un cliente vía el proxy Intuit.
// D-bvcpas-044: usa el proxy genérico POST /v1/intuit/realms/{realmId}/call
// porque no hay endpoint dedicado. Tipos locales (no del SDK — el
// proxy devuelve `unknown`).

import { api } from '@/lib/api/client'

export interface QboAccount {
  Id: string
  Name: string
  AccountType: string
}

const QBO_ACCOUNT_QUERY =
  'select Id, Name, AccountType from Account MAXRESULTS 1000'

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
    .filter(
      (a): a is QboAccount =>
        typeof a === 'object' &&
        a !== null &&
        'Id' in a &&
        'Name' in a &&
        typeof (a as QboAccount).Id === 'string' &&
        typeof (a as QboAccount).Name === 'string',
    )
    .map((a) => ({
      Id: (a as QboAccount).Id,
      Name: (a as QboAccount).Name,
      AccountType: (a as QboAccount).AccountType ?? '',
    }))
}
