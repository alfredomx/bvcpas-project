import { Controller, Get, Param, Query } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { IntuitReadService } from './intuit-read.service'
import { listQuerySchema, type ListQuery } from './dto/intuit.dto'
import type { Account } from './types/account.type'
import type { Attachable } from './types/attachable.type'
import type { Bill } from './types/bill.type'
import type { BillPayment } from './types/bill-payment.type'
import type { Class } from './types/class.type'
import type { CompanyCurrency } from './types/company-currency.type'
import type { CreditMemo } from './types/credit-memo.type'
import type { Customer } from './types/customer.type'
import type { Department } from './types/department.type'
import type { Deposit } from './types/deposit.type'
import type { Employee } from './types/employee.type'
import type { Estimate } from './types/estimate.type'
import type { ExchangeRate } from './types/exchange-rate.type'
import type { Invoice } from './types/invoice.type'
import type { Item } from './types/item.type'
import type { JournalEntry } from './types/journal-entry.type'
import type { Payment } from './types/payment.type'
import type { PaymentMethod } from './types/payment-method.type'
import type { Preferences } from './types/preferences.type'
import type { Purchase } from './types/purchase.type'
import type { PurchaseOrder } from './types/purchase-order.type'
import type { RefundReceipt } from './types/refund-receipt.type'
import type { SalesReceipt } from './types/sales-receipt.type'
import type { TaxAgency } from './types/tax-agency.type'
import type { TaxCode } from './types/tax-code.type'
import type { TaxRate } from './types/tax-rate.type'
import type { Term } from './types/term.type'
import type { TimeActivity } from './types/time-activity.type'
import type { Transfer } from './types/transfer.type'
import type { Vendor } from './types/vendor.type'
import type { VendorCredit } from './types/vendor-credit.type'

const uuidPipe = new ZodValidationPipe(z.string().uuid())
const listPipe = new ZodValidationPipe(listQuerySchema)

/**
 * Lecturas tipadas de entidades QBO (read-through, GET-only). Una ruta LITERAL
 * dedicada por type — `GET /v1/intuit/:clientId/<entidad>` (lista vía
 * Query API) y `.../<entidad>/:id` (por Id) — todas bajo el `AdminGuard` global.
 * El mapeo ruta→entidad QBO vive en `qbo-catalog.ts` (lo cruza un test).
 *
 * Excluidas a propósito: `CompanyInfo` (ya tiene endpoint mapeado propio),
 * `TaxService` (create-only en QBO). `ExchangeRate` va aquí pero como GET
 * dedicado (no es queryable).
 */
@Controller('intuit')
export class IntuitEntitiesController {
  constructor(private readonly read: IntuitReadService) {}

  @Get(':clientId/accounts')
  listAccounts(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Account[]> {
    return this.read.list<Account>(clientId, 'Account', q)
  }
  @Get(':clientId/accounts/:id')
  getAccount(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Account> {
    return this.read.getById<Account>(clientId, 'Account', id)
  }

  @Get(':clientId/attachables')
  listAttachables(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Attachable[]> {
    return this.read.list<Attachable>(clientId, 'Attachable', q)
  }
  @Get(':clientId/attachables/:id')
  getAttachable(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Attachable> {
    return this.read.getById<Attachable>(clientId, 'Attachable', id)
  }

  @Get(':clientId/bills')
  listBills(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Bill[]> {
    return this.read.list<Bill>(clientId, 'Bill', q)
  }
  @Get(':clientId/bills/:id')
  getBill(@Param('clientId', uuidPipe) clientId: string, @Param('id') id: string): Promise<Bill> {
    return this.read.getById<Bill>(clientId, 'Bill', id)
  }

  @Get(':clientId/bill-payments')
  listBillPayments(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<BillPayment[]> {
    return this.read.list<BillPayment>(clientId, 'BillPayment', q)
  }
  @Get(':clientId/bill-payments/:id')
  getBillPayment(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<BillPayment> {
    return this.read.getById<BillPayment>(clientId, 'BillPayment', id)
  }

  @Get(':clientId/classes')
  listClasses(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Class[]> {
    return this.read.list<Class>(clientId, 'Class', q)
  }
  @Get(':clientId/classes/:id')
  getClass(@Param('clientId', uuidPipe) clientId: string, @Param('id') id: string): Promise<Class> {
    return this.read.getById<Class>(clientId, 'Class', id)
  }

  @Get(':clientId/company-currencies')
  listCompanyCurrencies(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<CompanyCurrency[]> {
    return this.read.list<CompanyCurrency>(clientId, 'CompanyCurrency', q)
  }
  @Get(':clientId/company-currencies/:id')
  getCompanyCurrency(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<CompanyCurrency> {
    return this.read.getById<CompanyCurrency>(clientId, 'CompanyCurrency', id)
  }

  @Get(':clientId/credit-memos')
  listCreditMemos(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<CreditMemo[]> {
    return this.read.list<CreditMemo>(clientId, 'CreditMemo', q)
  }
  @Get(':clientId/credit-memos/:id')
  getCreditMemo(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<CreditMemo> {
    return this.read.getById<CreditMemo>(clientId, 'CreditMemo', id)
  }

  @Get(':clientId/customers')
  listCustomers(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Customer[]> {
    return this.read.list<Customer>(clientId, 'Customer', q)
  }
  @Get(':clientId/customers/:id')
  getCustomer(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Customer> {
    return this.read.getById<Customer>(clientId, 'Customer', id)
  }

  @Get(':clientId/departments')
  listDepartments(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Department[]> {
    return this.read.list<Department>(clientId, 'Department', q)
  }
  @Get(':clientId/departments/:id')
  getDepartment(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Department> {
    return this.read.getById<Department>(clientId, 'Department', id)
  }

  @Get(':clientId/deposits')
  listDeposits(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Deposit[]> {
    return this.read.list<Deposit>(clientId, 'Deposit', q)
  }
  @Get(':clientId/deposits/:id')
  getDeposit(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Deposit> {
    return this.read.getById<Deposit>(clientId, 'Deposit', id)
  }

  @Get(':clientId/employees')
  listEmployees(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Employee[]> {
    return this.read.list<Employee>(clientId, 'Employee', q)
  }
  @Get(':clientId/employees/:id')
  getEmployee(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Employee> {
    return this.read.getById<Employee>(clientId, 'Employee', id)
  }

  @Get(':clientId/estimates')
  listEstimates(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Estimate[]> {
    return this.read.list<Estimate>(clientId, 'Estimate', q)
  }
  @Get(':clientId/estimates/:id')
  getEstimate(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Estimate> {
    return this.read.getById<Estimate>(clientId, 'Estimate', id)
  }

  @Get(':clientId/invoices')
  listInvoices(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Invoice[]> {
    return this.read.list<Invoice>(clientId, 'Invoice', q)
  }
  @Get(':clientId/invoices/:id')
  getInvoice(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Invoice> {
    return this.read.getById<Invoice>(clientId, 'Invoice', id)
  }

  @Get(':clientId/items')
  listItems(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Item[]> {
    return this.read.list<Item>(clientId, 'Item', q)
  }
  @Get(':clientId/items/:id')
  getItem(@Param('clientId', uuidPipe) clientId: string, @Param('id') id: string): Promise<Item> {
    return this.read.getById<Item>(clientId, 'Item', id)
  }

  @Get(':clientId/journal-entries')
  listJournalEntries(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<JournalEntry[]> {
    return this.read.list<JournalEntry>(clientId, 'JournalEntry', q)
  }
  @Get(':clientId/journal-entries/:id')
  getJournalEntry(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<JournalEntry> {
    return this.read.getById<JournalEntry>(clientId, 'JournalEntry', id)
  }

  @Get(':clientId/payments')
  listPayments(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Payment[]> {
    return this.read.list<Payment>(clientId, 'Payment', q)
  }
  @Get(':clientId/payments/:id')
  getPayment(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Payment> {
    return this.read.getById<Payment>(clientId, 'Payment', id)
  }

  @Get(':clientId/payment-methods')
  listPaymentMethods(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<PaymentMethod[]> {
    return this.read.list<PaymentMethod>(clientId, 'PaymentMethod', q)
  }
  @Get(':clientId/payment-methods/:id')
  getPaymentMethod(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<PaymentMethod> {
    return this.read.getById<PaymentMethod>(clientId, 'PaymentMethod', id)
  }

  @Get(':clientId/preferences')
  listPreferences(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Preferences[]> {
    return this.read.list<Preferences>(clientId, 'Preferences', q)
  }
  @Get(':clientId/preferences/:id')
  getPreferences(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Preferences> {
    return this.read.getById<Preferences>(clientId, 'Preferences', id)
  }

  @Get(':clientId/purchases')
  listPurchases(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Purchase[]> {
    return this.read.list<Purchase>(clientId, 'Purchase', q)
  }
  @Get(':clientId/purchases/:id')
  getPurchase(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Purchase> {
    return this.read.getById<Purchase>(clientId, 'Purchase', id)
  }

  @Get(':clientId/purchase-orders')
  listPurchaseOrders(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<PurchaseOrder[]> {
    return this.read.list<PurchaseOrder>(clientId, 'PurchaseOrder', q)
  }
  @Get(':clientId/purchase-orders/:id')
  getPurchaseOrder(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<PurchaseOrder> {
    return this.read.getById<PurchaseOrder>(clientId, 'PurchaseOrder', id)
  }

  @Get(':clientId/refund-receipts')
  listRefundReceipts(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<RefundReceipt[]> {
    return this.read.list<RefundReceipt>(clientId, 'RefundReceipt', q)
  }
  @Get(':clientId/refund-receipts/:id')
  getRefundReceipt(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<RefundReceipt> {
    return this.read.getById<RefundReceipt>(clientId, 'RefundReceipt', id)
  }

  @Get(':clientId/sales-receipts')
  listSalesReceipts(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<SalesReceipt[]> {
    return this.read.list<SalesReceipt>(clientId, 'SalesReceipt', q)
  }
  @Get(':clientId/sales-receipts/:id')
  getSalesReceipt(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<SalesReceipt> {
    return this.read.getById<SalesReceipt>(clientId, 'SalesReceipt', id)
  }

  @Get(':clientId/tax-agencies')
  listTaxAgencies(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<TaxAgency[]> {
    return this.read.list<TaxAgency>(clientId, 'TaxAgency', q)
  }
  @Get(':clientId/tax-agencies/:id')
  getTaxAgency(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<TaxAgency> {
    return this.read.getById<TaxAgency>(clientId, 'TaxAgency', id)
  }

  @Get(':clientId/tax-codes')
  listTaxCodes(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<TaxCode[]> {
    return this.read.list<TaxCode>(clientId, 'TaxCode', q)
  }
  @Get(':clientId/tax-codes/:id')
  getTaxCode(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<TaxCode> {
    return this.read.getById<TaxCode>(clientId, 'TaxCode', id)
  }

  @Get(':clientId/tax-rates')
  listTaxRates(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<TaxRate[]> {
    return this.read.list<TaxRate>(clientId, 'TaxRate', q)
  }
  @Get(':clientId/tax-rates/:id')
  getTaxRate(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<TaxRate> {
    return this.read.getById<TaxRate>(clientId, 'TaxRate', id)
  }

  @Get(':clientId/terms')
  listTerms(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Term[]> {
    return this.read.list<Term>(clientId, 'Term', q)
  }
  @Get(':clientId/terms/:id')
  getTerm(@Param('clientId', uuidPipe) clientId: string, @Param('id') id: string): Promise<Term> {
    return this.read.getById<Term>(clientId, 'Term', id)
  }

  @Get(':clientId/time-activities')
  listTimeActivities(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<TimeActivity[]> {
    return this.read.list<TimeActivity>(clientId, 'TimeActivity', q)
  }
  @Get(':clientId/time-activities/:id')
  getTimeActivity(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<TimeActivity> {
    return this.read.getById<TimeActivity>(clientId, 'TimeActivity', id)
  }

  @Get(':clientId/transfers')
  listTransfers(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Transfer[]> {
    return this.read.list<Transfer>(clientId, 'Transfer', q)
  }
  @Get(':clientId/transfers/:id')
  getTransfer(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Transfer> {
    return this.read.getById<Transfer>(clientId, 'Transfer', id)
  }

  @Get(':clientId/vendors')
  listVendors(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<Vendor[]> {
    return this.read.list<Vendor>(clientId, 'Vendor', q)
  }
  @Get(':clientId/vendors/:id')
  getVendor(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<Vendor> {
    return this.read.getById<Vendor>(clientId, 'Vendor', id)
  }

  @Get(':clientId/vendor-credits')
  listVendorCredits(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(listPipe) q: ListQuery,
  ): Promise<VendorCredit[]> {
    return this.read.list<VendorCredit>(clientId, 'VendorCredit', q)
  }
  @Get(':clientId/vendor-credits/:id')
  getVendorCredit(
    @Param('clientId', uuidPipe) clientId: string,
    @Param('id') id: string,
  ): Promise<VendorCredit> {
    return this.read.getById<VendorCredit>(clientId, 'VendorCredit', id)
  }

  /**
   * ExchangeRate no es queryable: GET dedicado. Acepta `sourcecurrencycode`
   * (requerido por QBO) y `asofdate` opcional como query params.
   */
  @Get(':clientId/exchange-rate')
  exchangeRate(
    @Param('clientId', uuidPipe) clientId: string,
    @Query() args: Record<string, string>,
  ): Promise<ExchangeRate> {
    return this.read.exchangeRate(clientId, args) as Promise<ExchangeRate>
  }
}
