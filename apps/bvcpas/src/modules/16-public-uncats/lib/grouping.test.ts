import { describe, expect, it } from 'vitest'

import type { PublicUncatsResponseItem } from '../api/public-uncats.api'

import { buildOrdered } from './grouping'

function item(
  partial: Partial<PublicUncatsResponseItem> &
    Pick<PublicUncatsResponseItem, 'id' | 'category' | 'txn_date'>,
): PublicUncatsResponseItem {
  return {
    qbo_txn_type: 'Expense',
    docnum: null,
    vendor_name: null,
    memo: null,
    split_account: null,
    amount: '0.00',
    response: null,
    ...partial,
  }
}

describe('buildOrdered', () => {
  it('puts income first then expense, each block descending by date', () => {
    const result = buildOrdered([
      item({ id: 'e1', category: 'uncategorized_expense', txn_date: '2026-03-10' }),
      item({ id: 'i1', category: 'uncategorized_income', txn_date: '2026-03-05' }),
      item({ id: 'e2', category: 'uncategorized_expense', txn_date: '2026-03-01' }),
      item({ id: 'i2', category: 'uncategorized_income', txn_date: '2026-03-02' }),
    ])
    expect(result.map((r) => r.id)).toEqual(['i1', 'i2', 'e1', 'e2'])
  })

  it('returns empty when input is empty', () => {
    expect(buildOrdered([])).toEqual([])
  })
})
