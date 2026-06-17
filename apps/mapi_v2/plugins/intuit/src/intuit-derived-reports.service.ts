import { Injectable } from '@nestjs/common'
import { IntuitReadService } from './intuit-read.service'
import type { Report, ReportRow } from './types/report.type'

/** Las 3 categorías que produce el report uncat-amas. */
export type UncatCategory = 'uncategorized_expense' | 'uncategorized_income' | 'ask_my_accountant'

/** Fila plana del report uncat-amas (lo que se manda al cliente / al contador). */
export interface UncatAmaRow {
  id: string
  date: string
  txnType: string
  docnum: string | null
  vendor: string | null
  memo: string | null
  account: string | null
  category: UncatCategory
  amount: number
}

export interface UncatAmaOptions {
  startDate?: string
  endDate?: string
  accountingMethod?: string
  category?: UncatCategory
}

// Filtro y clasificación portados del mapi viejo (probados contra clientes reales).
const ROW_FILTER = /uncategorized (expense|income)|suspense|ask/i
const AMA = /ask/i

/**
 * Reports DERIVADOS de QBO (read-through, GET-only): no son passthrough de un
 * report nativo, sino construidos a partir de uno + filtrado/clasificación/mapeo.
 *
 * `uncatAmas`: a partir del report `TransactionList`, devuelve las transacciones
 * sin categorizar (uncategorized expense/income) y las "Ask My Accountant".
 */
@Injectable()
export class IntuitDerivedReportsService {
  constructor(private readonly read: IntuitReadService) {}

  async uncatAmas(clientId: string, opts: UncatAmaOptions = {}): Promise<UncatAmaRow[]> {
    const args: Record<string, string> = {
      accounting_method: opts.accountingMethod ?? 'Accrual',
    }
    if (opts.startDate) args.start_date = opts.startDate
    if (opts.endDate) args.end_date = opts.endDate

    const report = (await this.read.report(clientId, 'TransactionList', args)) as Report
    const rows = collectLeafRows(report.Rows?.Row ?? [])

    const out: UncatAmaRow[] = []
    for (const row of rows) {
      const cd = row.ColData ?? []
      const categoryCell = cd[7]?.value ?? ''
      if (!ROW_FILTER.test(categoryCell)) continue

      const txnType = cd[1]?.value ?? 'Unknown'
      const category: UncatCategory = AMA.test(categoryCell)
        ? 'ask_my_accountant'
        : txnType === 'Deposit'
          ? 'uncategorized_income'
          : 'uncategorized_expense'

      out.push({
        id: cd[1]?.id ?? '',
        date: cd[0]?.value ?? '',
        txnType,
        docnum: emptyToNull(cd[2]?.value),
        vendor: emptyToNull(cd[4]?.value),
        memo: emptyToNull(cd[5]?.value),
        account: emptyToNull(cd[6]?.value),
        category,
        amount: Math.abs(Number(cd[8]?.value ?? '0')),
      })
    }

    return opts.category ? out.filter((r) => r.category === opts.category) : out
  }
}

/** Celda vacía de QBO (`''`) o ausente → `null`; texto real se preserva. */
function emptyToNull(v: string | undefined): string | null {
  return v === undefined || v === '' ? null : v
}

/**
 * Aplana las filas del report. TransactionList suele venir plano, pero según la
 * config del cliente puede venir agrupado por secciones; recogemos solo las hojas
 * (las que traen `ColData`), sin romper el caso plano.
 */
function collectLeafRows(rows: ReportRow[]): ReportRow[] {
  const out: ReportRow[] = []
  for (const r of rows) {
    if (r.ColData) out.push(r)
    if (r.Rows?.Row) out.push(...collectLeafRows(r.Rows.Row))
  }
  return out
}
