import type {
  ReferenceType,
  CurrencyRefType,
  BigDecimal,
  ModificationMetaData,
  Line,
  TxnTaxDetail,
} from './common.type'

/**
 * JournalEntry Entity
 * Extracted from official Intuit Developer documentation
 */
export interface JournalEntry {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Individual line items of a transaction. There must be at least one pair of Journal Entry Line elements, representing a debit and a credit, called distribution lines. Valid Line types include: JournalEntryLine and DescriptionOnlyLine
   */
  Line?: Line[]

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Reference to the currency in which all amounts on the associated transaction are expressed. This must be defined if multicurrency is enabled for the company. Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here. Required if multicurrency is enabled for the company.
   */
  CurrencyRef?: CurrencyRefType

  /**
   * Method in which tax is applied. Allowed values are: TaxExcluded, TaxInclusive. Not applicable to US companies; required for non-US companies.
   */
  GlobalTaxCalculation?: string

  /**
   * Reference number for the transaction. Throws an error when duplicate DocNumber is sent in the request and if Preferences:OtherPrefs:NameValue.Name = WarnDuplicateJournalNumber is true. Recommended best practice: check the setting of Preferences:OtherPrefs:NameValue.Name = WarnDuplicateJournalNumber before setting DocNumber. If a duplicate DocNumber needs to be supplied, add the query parameter name/value pair, include=allowduplicatedocnum to the URI. Sort order is ASC by default. With this change V3 JournalEntry API will be supporting autoassign docNumber when null in the request only till minorversion=53. Starting minorversion=54 if null value is sent in the request null will be saved. With minorversion=54 if there is a need to support assigning a docNumber when null, it can be achieved through include param, include=allowautodocnum
   * @filterable
   */
  DocNumber?: string

  /**
   * User entered, organization-private note about the transaction.
   */
  PrivateNote?: string

  /**
   * The date entered by the user when this transaction occurred. For posting transactions, this is the posting date that affects the financial statements. If the date is not supplied, the current date on the server is used. Sort order is ASC by default.
   * @filterable
   */
  TxnDate?: string

  /**
   * The number of home currency units it takes to equal one unit of currency specified by CurrencyRef. Applicable if multicurrency is enabled for the company.
   */
  ExchangeRate?: number

  /**
   * Reference to the Tax Adjustment Rate Ids for this item. Query the TaxRate list resource to determine the appropriate TaxRate object for this reference. Use TaxRate.Id and TaxRate.Name from that object for TaxRateRef.value and TaxRateRef.name, respectively.
   */
  TaxRateRef?: ReferenceType

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
   * Indicates whether this transaction is a journal entry adjustment.
   */
  Adjustment?: boolean

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * A reference to the Recurring Transaction. It captures what recurring transaction template the JournalEntry was created from.
   */
  RecurDataRef?: ReferenceType

  /**
   * The value of this field will always be set to zero. Calculated by QuickBooks business logic; any value you supply is over-written by QuickBooks.
   */
  TotalAmt?: BigDecimal

  /**
   * The value of this field will always be set to zero. Applicable if multicurrency is enabled for the company.
   */
  HomeTotalAmt?: number

  /**
   * Reference to a JournalCode object. Query the JournalCode name list resource to determine the appropriate JournalCode object for this reference. Use JournalCode.Id and JournalCode.Name Required for France locales.
   */
  JournalCodeRef: ReferenceType

  /**
   * Unique identifier for this object.
   * @filterable
   */
  id?: string
}
