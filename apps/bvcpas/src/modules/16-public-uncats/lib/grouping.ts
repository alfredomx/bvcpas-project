// Ordena los items igual que el portal interno
// (`<CsTransactions>`): primero `uncategorized_income` por txn_date
// descendente, luego `uncategorized_expense` por txn_date descendente.
// Más reciente primero en ambos bloques.

import type { PublicUncatsResponseItem } from '../api/public-uncats.api'

export function buildOrdered(
  items: PublicUncatsResponseItem[],
): PublicUncatsResponseItem[] {
  const income = items
    .filter((i) => i.category === 'uncategorized_income')
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date))
  const expense = items
    .filter((i) => i.category === 'uncategorized_expense')
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date))
  return [...income, ...expense]
}
