import { describe, expect, it } from 'vitest'

import type { PublicUncatsResponseItem } from '../api/public-uncats.api'

import { deriveStats } from './derive-stats'

function item(
  amount: string,
  responded: boolean,
): PublicUncatsResponseItem {
  return {
    id: Math.random().toString(),
    qbo_txn_type: 'Expense',
    txn_date: '2026-03-01',
    docnum: null,
    vendor_name: null,
    memo: null,
    split_account: null,
    category: 'uncategorized_expense',
    amount,
    response: responded
      ? { client_note: 'x', completed: false, responded_at: '2026-05-21T00:00:00.000Z' }
      : null,
  }
}

describe('deriveStats', () => {
  it('returns zeros for empty input', () => {
    expect(deriveStats([])).toEqual({
      transactionsCount: 0,
      totalAmount: '0.00',
      pendingAmount: '0.00',
      respondedCount: 0,
      progressPct: 0,
    })
  })

  it('sums amounts with 2 decimals', () => {
    const stats = deriveStats([item('100.50', false), item('200.25', false)])
    expect(stats.totalAmount).toBe('300.75')
    expect(stats.transactionsCount).toBe(2)
  })

  it('counts responded and rounds progress', () => {
    const stats = deriveStats([
      item('100', true),
      item('100', false),
      item('100', false),
    ])
    expect(stats.respondedCount).toBe(1)
    expect(stats.progressPct).toBe(33)
  })

  it('pendingAmount excludes already responded items', () => {
    const stats = deriveStats([
      item('100', true),
      item('200', false),
      item('300', false),
    ])
    expect(stats.totalAmount).toBe('600.00')
    expect(stats.pendingAmount).toBe('500.00')
  })

  it('handles 100% complete with pendingAmount = 0', () => {
    const stats = deriveStats([item('50', true), item('50', true)])
    expect(stats.progressPct).toBe(100)
    expect(stats.pendingAmount).toBe('0.00')
  })

  it('ignores invalid amount strings', () => {
    const stats = deriveStats([item('not-a-number', false), item('10.00', false)])
    expect(stats.totalAmount).toBe('10.00')
  })
})
