import { describe, expect, it } from 'vitest'

import type { QboAccount } from '../api/qbo-accounts.api'

import { buildAccountTree } from './qbo-accounts-tree'

function acc(
  partial: Partial<QboAccount> & Pick<QboAccount, 'Id' | 'Name' | 'FullyQualifiedName'>,
): QboAccount {
  return {
    AcctNum: null,
    AccountType: 'Expense',
    SubAccount: false,
    ParentId: null,
    ...partial,
  }
}

describe('buildAccountTree', () => {
  it('keeps roots at depth 0 with their AccountType as rightLabel', () => {
    const rows = buildAccountTree([
      acc({ Id: '1', Name: 'Cash', FullyQualifiedName: 'Cash', AccountType: 'Bank' }),
      acc({
        Id: '2',
        Name: 'Office Supplies',
        FullyQualifiedName: 'Office Supplies',
        AccountType: 'Expense',
      }),
    ])
    expect(rows.map((r) => [r.displayName, r.depth, r.rightLabel])).toEqual([
      ['Cash', 0, 'Bank'],
      ['Office Supplies', 0, 'Expense'],
    ])
  })

  it('marks direct children with "Sub of <padre>" using the direct parent name', () => {
    const rows = buildAccountTree([
      acc({
        Id: '10',
        Name: 'Staff Salaries and Wages',
        FullyQualifiedName: 'Staff Salaries and Wages',
      }),
      acc({
        Id: '11',
        Name: 'Back of House Staff',
        FullyQualifiedName: 'Staff Salaries and Wages:Back of House Staff',
        SubAccount: true,
        ParentId: '10',
      }),
    ])
    const child = rows.find((r) => r.Id === '11')!
    expect(child.depth).toBe(1)
    expect(child.rightLabel).toBe('Sub of Staff Salaries and Wages')
  })

  it('supports 3 levels and orders siblings alphabetically inside the same parent', () => {
    const rows = buildAccountTree([
      acc({ Id: '20', Name: 'Staff Salaries', FullyQualifiedName: 'Staff Salaries' }),
      acc({
        Id: '21',
        Name: 'Back of House Staff',
        FullyQualifiedName: 'Staff Salaries:Back of House Staff',
        SubAccount: true,
        ParentId: '20',
      }),
      acc({
        Id: '23',
        Name: 'Expeditor',
        FullyQualifiedName: 'Staff Salaries:Back of House Staff:Expeditor',
        SubAccount: true,
        ParentId: '21',
      }),
      acc({
        Id: '22',
        Name: 'Dishwashers',
        FullyQualifiedName: 'Staff Salaries:Back of House Staff:Dishwashers',
        SubAccount: true,
        ParentId: '21',
      }),
    ])
    expect(rows.map((r) => r.displayName)).toEqual([
      'Staff Salaries',
      'Back of House Staff',
      'Dishwashers',
      'Expeditor',
    ])
    const expeditor = rows.find((r) => r.Id === '23')!
    expect(expeditor.depth).toBe(2)
    expect(expeditor.rightLabel).toBe('Sub of Back of House Staff')
  })

  it('falls back to the penultimate segment when ParentId is missing', () => {
    const rows = buildAccountTree([
      acc({
        Id: '30',
        Name: 'Orphan child',
        FullyQualifiedName: 'Missing Parent:Orphan child',
        SubAccount: true,
        ParentId: null,
      }),
    ])
    expect(rows[0].rightLabel).toBe('Sub of Missing Parent')
  })

  it('searchText uses the full path lowercased', () => {
    const rows = buildAccountTree([
      acc({
        Id: '40',
        Name: 'Management - FOH',
        FullyQualifiedName: 'Management Salaries and Wages:Management - FOH',
        SubAccount: true,
        ParentId: 'X',
      }),
    ])
    expect(rows[0].searchText).toBe(
      'management salaries and wages:management - foh',
    )
  })

  it('prefixes AcctNum to displayName when present and includes it in searchText', () => {
    const rows = buildAccountTree([
      acc({
        Id: '50',
        Name: 'Chase CC #6979',
        FullyQualifiedName: 'Credit Cards:Chase CC #6979',
        AcctNum: '2810',
        SubAccount: true,
        ParentId: 'CC',
        AccountType: 'Credit Card',
      }),
      acc({
        Id: '51',
        Name: 'Cash on hand',
        FullyQualifiedName: 'Cash on hand',
        AcctNum: null,
        AccountType: 'Bank',
      }),
    ])
    const chase = rows.find((r) => r.Id === '50')!
    const cash = rows.find((r) => r.Id === '51')!
    expect(chase.displayName).toBe('2810 Chase CC #6979')
    expect(chase.searchText).toBe('credit cards:chase cc #6979 2810')
    expect(cash.displayName).toBe('Cash on hand')
    expect(cash.searchText).toBe('cash on hand')
  })
})
