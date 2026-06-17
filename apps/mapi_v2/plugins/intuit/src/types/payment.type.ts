import type {
  ReferenceType,
  CurrencyRefType,
  ModificationMetaData,
  Line,
  CreditCardPayment,
} from './common.type'

/**
 * Payment Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Payment {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Indicates the total amount of the transaction. This includes the total of all the charges, allowances, and taxes. If you process a linked refund transaction against a specific transaction, the totalAmt value won't change. It will remain the same. However, voiding the linked refund will change the totalAmt value to O.
   */
  TotalAmt?: number

  /**
   * Reference to a customer or job. Query the Customer name list resource to determine the appropriate Customer object for this reference. Use Customer.Id and Customer.DisplayName from that object for CustomerRef.value and CustomerRef.name, respectively.
   * @filterable
   */
  CustomerRef?: ReferenceType

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
   * Reference to the Project ID associated with this transaction. Available with Minor Version 69 and above
   * @filterable
   */
  ProjectRef?: ReferenceType

  /**
   * User entered, organization-private note about the transaction.
   */
  PrivateNote?: string

  /**
   * Reference to a PaymentMethod associated with this transaction. Query the PaymentMethod name list resource to determine the appropriate PaymentMethod object for this reference. Use PaymentMethod.Id and PaymentMethod.Name from that object for PaymentMethodRef.value and PaymentMethodRef.name, respectively.
   */
  PaymentMethodRef?: ReferenceType

  /**
   * Indicates the amount that has not been applied to pay amounts owed for sales transactions.
   */
  UnappliedAmt?: number

  /**
   * Identifies the account to be used for this payment. Query the Account name list resource to determine the appropriate Account object for this reference, where Account.AccountType is Other Current Asset or Bank. Use Account.Id and Account.Name from that object for DepositToAccountRef.value and DepostiToAccountRef.name, respectively.
   * If you do not specify this account, payment is applied to the Undeposited Funds account.
   */
  DepositToAccountRef?: ReferenceType

  /**
   * The number of home currency units it takes to equal one unit of currency specified by CurrencyRef. Applicable if multicurrency is enabled for the company
   */
  ExchangeRate?: number

  /**
   * Zero or more transactions accounting for this payment. Values for Line.LinkedTxn.TxnTypecan be one of the following:
   * Expense--Payment is reimbursement for expense paid by cash made on behalf of the customer
   * Check--Payment is reimbursement for expense paid by check made on behalf of the customer
   * CreditCardCredit--Payment is reimbursement for a credit card credit made on behalf of the customer
   * JournalEntry--Payment is linked to the representative journal entry
   * CreditMemo--Payment is linked to the credit memo the customer has with the business
   * Invoice--The invoice to which payment is applied
   * Use Line.LinkedTxn.TxnId as the ID in a separate read request for the specific resource to retrieve details of the linked object.
   */
  Line?: Line[]

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
   * Information about a payment received by credit card. Inject with data only if the payment was transacted through Intuit Payments API.
   */
  CreditCardPayment?: CreditCardPayment

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
   * Descriptive information about the entity. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * The reference number for the payment received. For example,  Check # for a check, envelope # for a cash donation. Required for France locales.
   * @filterable
   */
  PaymentRefNum: string

  /**
   * Reference to the TaxExepmtion ID associated with this object. Available for companies that have automated sales tax enabled.
   * TaxExemptionRef.Name: The Tax Exemption Id for the customer to which this object is associated. This Id is typically issued by the state.
   * TaxExemptionRef.value: The system-generated Id of the exemption type.
   * For internal use only
   */
  TaxExemptionRef?: ReferenceType

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
