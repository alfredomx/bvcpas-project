import type { ReferenceType, ModificationMetaData } from './common.type'

/**
 * Transfer Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Transfer {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Identifies the asset account to which funds are transfered. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for ToAccountRef.value and ToAccountRef.name, respectively. The specified account must have Account.Classification set to Asset.
   */
  ToAccountRef?: ReferenceType

  /**
   * Indicates the total amount of the transaction.
   */
  Amount?: number

  /**
   * Identifies the asset account from which funds are transfered. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for FromAccountRef.value and FromAccountRef.name, respectively. The specified account must have Account.Classification set to Asset.
   */
  FromAccountRef?: ReferenceType

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * User entered, organization-private note about the transaction. This note does not appear on the invoice to the customer. This field maps to the Memo field on the Invoice form.
   */
  PrivateNote?: string

  /**
   * The date entered by the user when this transaction occurred. For posting transactions, this is the posting date that affects the financial statements. If the date is not supplied, the current date on the server is used. Sort order is ASC by default.
   * @filterable
   */
  TxnDate?: string

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
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * A reference to the Recurring Transaction. It captures what recurring transaction template the Transfer was created from.
   */
  RecurDataRef?: ReferenceType
}
