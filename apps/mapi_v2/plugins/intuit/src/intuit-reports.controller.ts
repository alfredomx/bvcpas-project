import { Controller, Get, Param, Query } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { IntuitReadService } from './intuit-read.service'
import type { Report } from './types/report.type'
import type { AccountListDetailArgs } from './types/reports/account-list-detail.args'
import type { APAgingDetailArgs } from './types/reports/apaging-detail.args'
import type { APAgingSummaryArgs } from './types/reports/apaging-summary.args'
import type { ARAgingDetailArgs } from './types/reports/araging-detail.args'
import type { ARAgingSummaryArgs } from './types/reports/araging-summary.args'
import type { BalanceSheetArgs } from './types/reports/balance-sheet.args'
import type { CashFlowArgs } from './types/reports/cash-flow.args'
import type { CustomerBalanceArgs } from './types/reports/customer-balance.args'
import type { CustomerBalanceDetailArgs } from './types/reports/customer-balance-detail.args'
import type { CustomerIncomeArgs } from './types/reports/customer-income.args'
import type { GeneralLedgerArgs } from './types/reports/general-ledger.args'
import type { InventoryValuationSummaryArgs } from './types/reports/inventory-valuation-summary.args'
import type { JournalReportArgs } from './types/reports/journal-report.args'
import type { ProfitAndLossArgs } from './types/reports/profit-and-loss.args'
import type { ProfitAndLossDetailArgs } from './types/reports/profit-and-loss-detail.args'
import type { TransactionListArgs } from './types/reports/transaction-list.args'
import type { TrialBalanceArgs } from './types/reports/trial-balance.args'
import type { VendorBalanceArgs } from './types/reports/vendor-balance.args'
import type { VendorBalanceDetailArgs } from './types/reports/vendor-balance-detail.args'
import type { VendorExpensesArgs } from './types/reports/vendor-expenses.args'

const uuidPipe = new ZodValidationPipe(z.string().uuid())

/** Convierte los args (objeto) a `Record<string,string>` para el query de QBO. */
function asArgs(o: object): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'string') {
      if (v !== '') out[k] = v
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v)
    }
  }
  return out
}

/**
 * Reports de QBO (read-through, GET-only). Una ruta LITERAL dedicada por report
 * — `GET /v1/intuit/:clientId/reports/<report>` — bajo el `AdminGuard`
 * global. Todos devuelven el mismo shape `Report`; lo que cambia son los args,
 * que se reenvían tal cual como query string a QBO. El mapeo ruta→report QBO
 * vive en `qbo-catalog.ts` (lo cruza un test).
 */
@Controller('intuit')
export class IntuitReportsController {
  constructor(private readonly read: IntuitReadService) {}

  @Get(':clientId/reports/account-list-detail')
  accountListDetail(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: AccountListDetailArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'AccountList', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/apaging-detail')
  apAgingDetail(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: APAgingDetailArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'AgedPayableDetail', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/apaging-summary')
  apAgingSummary(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: APAgingSummaryArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'AgedPayables', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/araging-detail')
  arAgingDetail(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: ARAgingDetailArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'AgedReceivableDetail', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/araging-summary')
  arAgingSummary(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: ARAgingSummaryArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'AgedReceivables', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/balance-sheet')
  balanceSheet(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: BalanceSheetArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'BalanceSheet', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/cash-flow')
  cashFlow(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: CashFlowArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'CashFlow', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/customer-balance')
  customerBalance(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: CustomerBalanceArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'CustomerBalance', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/customer-balance-detail')
  customerBalanceDetail(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: CustomerBalanceDetailArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'CustomerBalanceDetail', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/customer-income')
  customerIncome(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: CustomerIncomeArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'CustomerIncome', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/general-ledger')
  generalLedger(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: GeneralLedgerArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'GeneralLedger', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/inventory-valuation-summary')
  inventoryValuationSummary(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: InventoryValuationSummaryArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'InventoryValuationSummary', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/journal-report')
  journalReport(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: JournalReportArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'JournalReport', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/profit-and-loss')
  profitAndLoss(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: ProfitAndLossArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'ProfitAndLoss', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/profit-and-loss-detail')
  profitAndLossDetail(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: ProfitAndLossDetailArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'ProfitAndLossDetail', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/transaction-list')
  transactionList(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: TransactionListArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'TransactionList', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/trial-balance')
  trialBalance(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: TrialBalanceArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'TrialBalance', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/vendor-balance')
  vendorBalance(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: VendorBalanceArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'VendorBalance', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/vendor-balance-detail')
  vendorBalanceDetail(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: VendorBalanceDetailArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'VendorBalanceDetail', asArgs(args)) as Promise<Report>
  }

  @Get(':clientId/reports/vendor-expenses')
  vendorExpenses(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: VendorExpensesArgs,
  ): Promise<Report> {
    return this.read.report(clientId, 'VendorExpenses', asArgs(args)) as Promise<Report>
  }
}
