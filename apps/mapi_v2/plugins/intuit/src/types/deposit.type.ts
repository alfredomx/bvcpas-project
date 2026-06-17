import type {
  ReferenceType,
  CurrencyRefType,
  BigDecimal,
  ModificationMetaData,
  Line,
  TxnTaxDetail,
  CashBackInfo,
} from './common.type'

/**
 * Deposit Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Deposit {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Identifies the account to be used for this deposit. Query the Account name list resource to determine the appropriate Account object for this reference, where Account.AccountType is Other Current Asset or Bank. Use Account.Id and Account.Name from that object for DepositToAccountRef.value and DepostiToAccountRef.name, respectively.
   */
  DepositToAccountRef?: ReferenceType

  /**
   * Individual line items comprising the deposit. Specify a Line.LinkedTxn element along with DepositLine detail type if this line is to record a deposit for an existing transaction. Select UndepositedFunds account on the existing transaction to make it available for the Deposit.
   * Possible types of transactions that can be linked to a Deposit include: Transfer, Payment (for Cash, CreditCard, and Check payment method types), SalesReceipt, RefundReceipt, JournalEntry.
   * In addition, any expense object whose line item has AccountReceivable can be linked to a Payment and then that Payment can be linked to a Deposit object.
   * Use Line.LinkedTxn.TxnId as the ID in a separate read request for the specific resource to retrieve details of the linked object. Valid Line types include: LinkedTxn and DepositLine
   */
  Line?: Line[]

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Method in which tax is applied. Allowed values are: TaxExcluded, TaxInclusive, and NotApplicable. Not applicable to US companies; required for non-US companies.
   */
  GlobalTaxCalculation?: string

  /**
   * Reference to the currency in which all amounts on the associated transaction are expressed. This must be defined if multicurrency is enabled for the company.
   * Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here. The CurrencyRef can be overwritten by the Line.DepositLineDetail Entity. If the customer that you are referring to has a default currency of USD then the currency for this Deposit will always be set as USD.
   */
  CurrencyRef?: CurrencyRefType

  /**
   * User entered, organization-private note about the transaction. This note does not appear on the invoice to the customer. This field maps to the Memo field on the Invoice form.
   */
  PrivateNote?: string

  /**
   * The number of home currency units it takes to equal one unit of currency specified by CurrencyRef. Applicable if multicurrency is enabled for the company.
   */
  ExchangeRate?: number

  /**
   * A reference to a Department object specifying the location of the transaction, as defined using location tracking in QuickBooks Online. Available if Preferences.AccountingInfoPrefs.TrackDepartments is set to true. Query the Department name list resource to determine the appropriate Department object for this reference. Use Department.Id and Department.Name from that object for DepartmentRef.value and DepartmentRef.name, respectively.
   */
  DepartmentRef?: ReferenceType

  /**
   * Used internally to specify originating source of a credit card transaction.
   */
  TxnSource?: string

  /**
   * The date entered by the user when this transaction occurred. For posting transactions, this is the posting date that affects the financial statements. If the date is not supplied, the current date on the server is used.
   * Sort order is ASC by default.
   * @filterable
   */
  TxnDate?: string

  /**
   */
  CashBack?: CashBackInfo

  /**
   * The account location. Valid values include:
   * WithinFrance
   * FranceOverseas
   * OutsideFranceWithEU
   * OutsideEU
   * For France locales, only.
   */
  TransactionLocationType?: string

  /**
   * This data type provides information for taxes charged on the transaction as a whole. It captures the details sales taxes calculated for the transaction based on the tax codes referenced by the transaction. This can be calculated by QuickBooks business logic or you may supply it when adding a transaction. See Global tax model for more information about this element. If sales tax is disabled (Preferences.TaxPrefs.UsingSalesTax is set to false) then TxnTaxDetail is ignored and not stored.
   */
  TxnTaxDetail?: TxnTaxDetail

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * A reference to the Recurring Transaction. It captures what recurring transaction template the Deposit was created from.
   */
  RecurDataRef?: ReferenceType

  /**
   * Indicates the total amount of the transaction. This includes the total of all the charges, allowances, and taxes. Calculated by QuickBooks business logic; any value you supply is over-written by QuickBooks.
   */
  TotalAmt?: BigDecimal

  /**
   * Total amount of the transaction in the home currency. Includes the total of all the charges, allowances and taxes. Calculated by QuickBooks business logic. Value is valid only when CurrencyRef is specified. Applicable if multicurrency is enabled for the company.
   */
  HomeTotalAmt?: number

  /**
   * Unique identifier for this object.
   * @filterable
   */
  id?: string
}
