import { IntuitDerivedReportsService } from '@plugins/intuit/src/intuit-derived-reports.service'
import type { IntuitReadService } from '@plugins/intuit/src/intuit-read.service'

// Fila estilo TransactionList: ColData posicional [date, type+id, docnum, _, vendor, memo, account, category, amount].
function row(cols: Array<{ value?: string; id?: string }>) {
  return { ColData: cols }
}

// Report con 1 uncategorized expense, 1 uncategorized income (Deposit),
// 1 AMA, y 1 fila categorizada (que NO debe pasar el filtro).
const REPORT = {
  Rows: {
    Row: [
      row([
        { value: '2026-01-05' },
        { value: 'Expense', id: '101' },
        { value: 'DOC1' },
        {},
        { value: 'Home Depot' },
        { value: 'memo expense' },
        { value: 'Chase Checking' },
        { value: 'Uncategorized Expense' },
        { value: '-487.20' },
      ]),
      row([
        { value: '2026-01-06' },
        { value: 'Deposit', id: '102' },
        {},
        {},
        { value: 'Stripe' },
        { value: 'memo income' },
        { value: 'Chase Checking' },
        { value: 'Uncategorized Income' },
        { value: '1200.00' },
      ]),
      row([
        { value: '2026-01-07' },
        { value: 'Check', id: '103' },
        { value: '1452' },
        {},
        { value: 'Unknown LLC' },
        { value: 'que es esto' },
        { value: 'Chase Checking' },
        { value: 'Ask My Accountant' },
        { value: '-90.00' },
      ]),
      row([
        { value: '2026-01-08' },
        { value: 'Expense', id: '104' },
        {},
        {},
        { value: 'Alsco' },
        { value: 'memo' },
        { value: 'Chase Checking' },
        { value: 'Cleaning Supplies' }, // categorizada → fuera
        { value: '-50.00' },
      ]),
    ],
  },
}

function svc(report: unknown): IntuitDerivedReportsService {
  const read = { report: jest.fn().mockResolvedValue(report) } as unknown as IntuitReadService
  return new IntuitDerivedReportsService(read)
}

describe('IntuitDerivedReportsService.uncatAmas', () => {
  it('filtra solo uncats + AMA y descarta las categorizadas', async () => {
    const rows = await svc(REPORT).uncatAmas('c1')
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.category).sort()).toEqual([
      'ask_my_accountant',
      'uncategorized_expense',
      'uncategorized_income',
    ])
  })

  it('clasifica y mapea cada fila', async () => {
    const rows = await svc(REPORT).uncatAmas('c1')
    const expense = rows.find((r) => r.id === '101')!
    expect(expense).toEqual({
      id: '101',
      date: '2026-01-05',
      txnType: 'Expense',
      docnum: 'DOC1',
      vendor: 'Home Depot',
      memo: 'memo expense',
      account: 'Chase Checking',
      category: 'uncategorized_expense',
      amount: 487.2, // abs
    })
    expect(rows.find((r) => r.id === '102')!.category).toBe('uncategorized_income')
    expect(rows.find((r) => r.id === '103')!.category).toBe('ask_my_accountant')
  })

  it('respeta el filtro ?category', async () => {
    const rows = await svc(REPORT).uncatAmas('c1', { category: 'ask_my_accountant' })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('103')
  })

  it('pasa accounting_method + rango y default Accrual al report TransactionList', async () => {
    const read = { report: jest.fn().mockResolvedValue(REPORT) } as unknown as IntuitReadService
    const s = new IntuitDerivedReportsService(read)
    await s.uncatAmas('c1', { startDate: '2025-01-01', endDate: '2026-06-16' })
    expect(read.report).toHaveBeenCalledWith('c1', 'TransactionList', {
      accounting_method: 'Accrual',
      start_date: '2025-01-01',
      end_date: '2026-06-16',
    })
  })

  it('aplana filas anidadas por secciones (recoge solo las hojas con ColData)', async () => {
    const nested = {
      Rows: {
        Row: [
          {
            Header: { ColData: [{ value: 'Section' }] },
            Rows: { Row: REPORT.Rows.Row },
            Summary: { ColData: [{ value: 'total' }] },
          },
        ],
      },
    }
    const rows = await svc(nested).uncatAmas('c1')
    expect(rows).toHaveLength(3)
  })

  it('report vacío → arreglo vacío', async () => {
    expect(await svc({}).uncatAmas('c1')).toEqual([])
  })
})
