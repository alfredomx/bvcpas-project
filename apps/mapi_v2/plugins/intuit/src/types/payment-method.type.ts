import type { ModificationMetaData } from './common.type'

/**
 * PaymentMethod Entity
 * Extracted from official Intuit Developer documentation
 */
export interface PaymentMethod {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * User recognizable name for the payment method.
   */
  Name: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * If true, this entity is currently enabled for use by QuickBooks.
   * @filterable
   */
  Active?: boolean

  /**
   * Defines the type of payment. Valid values include CREDIT_CARD or NON_CREDIT_CARD.
   */
  Type?: string

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData
}
