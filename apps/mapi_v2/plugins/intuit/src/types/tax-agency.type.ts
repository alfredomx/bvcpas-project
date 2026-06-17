import type { ModificationMetaData } from './common.type'

/**
 * TaxAgency Entity
 * Extracted from official Intuit Developer documentation
 */
export interface TaxAgency {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Name of the agency.
   * @sortable
   */
  DisplayName?: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Denotes whether this tax agency is used to track tax on sales.
   */
  TaxTrackedOnSales?: boolean

  /**
   * Denotes whether this tax agency is used to track tax on purchases.
   */
  TaxTrackedOnPurchases?: boolean

  /**
   * The last tax filing date for this tax agency. This field is automatically populated by QuickBooks business logic at tax filing time.
   */
  LastFileDate?: string

  /**
   * Registration number for the agency.
   */
  TaxRegistrationNumber?: string

  /**
   * Descriptive information about the entity. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Flag to identify whether the TaxAgency is system defined by Automated Sales Tax engine or user generated. Valid values include USER_DEFINED, SYSTEM_GENERATEDSYSTEM_GENERATED.
   */
  TaxAgencyConfig?: string
}
