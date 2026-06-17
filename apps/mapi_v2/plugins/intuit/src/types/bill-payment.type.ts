import type {
  ReferenceType,
  CurrencyRefType,
  BigDecimal,
  ModificationMetaData,
  Line,
  BillPaymentCheck,
  BillPaymentCreditCard,
} from './common.type'

/**
 * BillPayment Entity
 * Extracted from official Intuit Developer documentation
 */
export interface BillPayment {
  /**
   * Unique Identifier for an Intuit entity (object). Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Reference to the vendor for this transaction. Query the Vendor name list resource to determine the appropriate Vendor object for this reference. Use Vendor.Id and Vendor.Name from that object for VendorRef.value and VendorRef.name, respectively.
   * @filterable
   */
  VendorRef?: ReferenceType

  /**
   * Individual line items representing zero or more Bill, VendorCredit, and JournalEntry objects linked to this BillPayment object. Use Line.LinkedTxn.TxnId as the ID in a separate Bill, VendorCredit, or JournalEntry read request to retrieve details of the linked object.
   * LinkedTxnLine:
   */
  Line?: Line[]

  /**
   * Indicates the total amount associated with this payment. This includes the total of all the payments from the payment line details. If TotalAmt is greater than the total on the lines being paid, the overpayment is treated as a credit and exposed as such on the QuickBooks UI. It cannot be negative.
   * @filterable
   */
  TotalAmt?: BigDecimal

  /**
   * The payment type. Valid values include: Check, CreditCard
   */
  PayType?: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Reference to the currency in which all amounts on the associated transaction are expressed. This must be defined if multicurrency is enabled for the company.
   * Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here. Required if multicurrency is enabled for the company.
   */
  CurrencyRef?: CurrencyRefType

  /**
   * Reference number for the transaction. If not explicitly provided at create time, a custom value can be provided. If no value is supplied, the resulting DocNumber is null. Throws an error when duplicate DocNumber is sent in the request. Recommended best practice: check the setting of Preferences:OtherPrefs before setting DocNumber. If a duplicate DocNumber needs to be supplied, add the query parameter name/value pair, include=allowduplicatedocnum to the URI. Sort order is ASC by default.
   * @filterable
   */
  DocNumber?: string

  /**
   * User entered, organization-private note about the transaction. This note does not appear on the invoice to the customer. This field maps to the Memo field on the form.
   */
  PrivateNote?: string

  /**
   * The date entered by the user when this transaction occurred. For posting transactions, this is the posting date that affects the financial statements. If the date is not supplied, the current date on the server is used.
   * Sort order is ASC by default.
   * @filterable
   */
  TxnDate?: string

  /**
   * The number of home currency units it takes to equal one unit of currency specified by CurrencyRef. Applicable if multicurrency is enabled for the company.
   */
  ExchangeRate?: number

  /**
   * Specifies to which AP account the bill is credited. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for APAccountRef.value and APAccountRef.name, respectively. The specified account must have Account.Classification set to Liability and Account.AccountSubType set to AccountsPayable.
   * If the company has a single AP account, the account is implied. However, it is recommended that the AP Account be explicitly specified in all cases to prevent unexpected errors when relating transactions to each other.
   * @filterable
   */
  APAccountRef?: ReferenceType

  /**
   * A reference to a Department object specifying the location of the transaction, as defined using location tracking in QuickBooks Online. Query the Department name list resource to determine the appropriate department object for this reference. Use Department.Id and Department.Name from that object for DepartmentRef.value and DepartmentRef.name, respectively.
   */
  DepartmentRef?: ReferenceType

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
   * Indicates that the payment should be processed by merchant account service. Valid for QuickBooks companies with credit card processing.
   */
  ProcessBillPayment?: boolean

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Information about a check payment for the transaction. Not applicable to Estimate and SalesOrder. Used when PayType is Check.
   * @filterable
   */
  CheckPayment?: BillPaymentCheck

  /**
   * Information about a credit card payment for the transaction. Not applicable to Estimate and SalesOrder. Required when PayType is CreditCard.
   * @filterable
   */
  CreditCardPayment: BillPaymentCreditCard

  /**
   * Unique identifier for this object.
   * @filterable
   */
  id?: string

  /**
   * Include and set to true to void an object.
   */
  sparse?: string
}
