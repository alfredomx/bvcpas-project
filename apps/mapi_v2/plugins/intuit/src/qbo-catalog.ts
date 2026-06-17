/**
 * Catálogo de lecturas tipadas de QBO (read-through, GET-only).
 *
 * Fuente única de verdad de:
 *  - qué entidades exponemos y a qué nombre de entidad QBO mapean,
 *  - qué reports exponemos y a qué nombre de report QBO mapean.
 *
 * Los controllers tienen una ruta LITERAL dedicada por type (no un `:entity`
 * genérico); este catálogo existe para documentar el mapeo y para que un test
 * cruce que no falte ni sobre ninguna ruta. Las rutas literales y estas entradas
 * deben coincidir 1:1 (lo verifica `test/unit/intuit/qbo-catalog.spec.ts`).
 *
 * Exclusiones conscientes:
 *  - `CompanyInfo`: ya tiene endpoint propio mapeado (`/clients/:id/company-info`).
 *  - `TaxService`: create-only en QBO (POST /taxservice/taxcode); no es leíble.
 *  - `ExchangeRate`: no es queryable; va por un GET dedicado aparte (no en esta lista).
 */

/** Entidad QBO leíble por Query API (`SELECT * FROM <entity>`) + read-by-id. */
export interface QboEntity {
  /** Segmento de ruta en plural-kebab: `/v1/intuit/clients/:clientId/<route>`. */
  route: string
  /** Nombre de la entidad en QBO (para el `SELECT * FROM` y el path `/<lower>/:id`). */
  entity: string
}

/** Report QBO (`/reports/<name>`); mismo shape `Report`, args por query string. */
export interface QboReport {
  /** Segmento de ruta: `/v1/intuit/clients/:clientId/reports/<route>`. */
  route: string
  /** Nombre del report en QBO. */
  name: string
}

export const QBO_ENTITIES: readonly QboEntity[] = [
  { route: 'accounts', entity: 'Account' },
  { route: 'attachables', entity: 'Attachable' },
  { route: 'bills', entity: 'Bill' },
  { route: 'bill-payments', entity: 'BillPayment' },
  { route: 'classes', entity: 'Class' },
  { route: 'company-currencies', entity: 'CompanyCurrency' },
  { route: 'credit-memos', entity: 'CreditMemo' },
  { route: 'customers', entity: 'Customer' },
  { route: 'departments', entity: 'Department' },
  { route: 'deposits', entity: 'Deposit' },
  { route: 'employees', entity: 'Employee' },
  { route: 'estimates', entity: 'Estimate' },
  { route: 'invoices', entity: 'Invoice' },
  { route: 'items', entity: 'Item' },
  { route: 'journal-entries', entity: 'JournalEntry' },
  { route: 'payments', entity: 'Payment' },
  { route: 'payment-methods', entity: 'PaymentMethod' },
  { route: 'preferences', entity: 'Preferences' },
  { route: 'purchases', entity: 'Purchase' },
  { route: 'purchase-orders', entity: 'PurchaseOrder' },
  { route: 'refund-receipts', entity: 'RefundReceipt' },
  { route: 'sales-receipts', entity: 'SalesReceipt' },
  { route: 'tax-agencies', entity: 'TaxAgency' },
  { route: 'tax-codes', entity: 'TaxCode' },
  { route: 'tax-rates', entity: 'TaxRate' },
  { route: 'terms', entity: 'Term' },
  { route: 'time-activities', entity: 'TimeActivity' },
  { route: 'transfers', entity: 'Transfer' },
  { route: 'vendors', entity: 'Vendor' },
  { route: 'vendor-credits', entity: 'VendorCredit' },
] as const

export const QBO_REPORTS: readonly QboReport[] = [
  { route: 'account-list-detail', name: 'AccountList' },
  { route: 'apaging-detail', name: 'AgedPayableDetail' },
  { route: 'apaging-summary', name: 'AgedPayables' },
  { route: 'araging-detail', name: 'AgedReceivableDetail' },
  { route: 'araging-summary', name: 'AgedReceivables' },
  { route: 'balance-sheet', name: 'BalanceSheet' },
  { route: 'cash-flow', name: 'CashFlow' },
  { route: 'customer-balance', name: 'CustomerBalance' },
  { route: 'customer-balance-detail', name: 'CustomerBalanceDetail' },
  { route: 'customer-income', name: 'CustomerIncome' },
  { route: 'general-ledger', name: 'GeneralLedger' },
  { route: 'inventory-valuation-summary', name: 'InventoryValuationSummary' },
  { route: 'journal-report', name: 'JournalReport' },
  { route: 'profit-and-loss', name: 'ProfitAndLoss' },
  { route: 'profit-and-loss-detail', name: 'ProfitAndLossDetail' },
  { route: 'transaction-list', name: 'TransactionList' },
  { route: 'trial-balance', name: 'TrialBalance' },
  { route: 'vendor-balance', name: 'VendorBalance' },
  { route: 'vendor-balance-detail', name: 'VendorBalanceDetail' },
  { route: 'vendor-expenses', name: 'VendorExpenses' },
] as const
