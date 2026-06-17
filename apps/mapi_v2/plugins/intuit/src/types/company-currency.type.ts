import type { ModificationMetaData, CustomField } from './common.type'

/**
 * CompanyCurrency Entity
 * Extracted from official Intuit Developer documentation
 */
export interface CompanyCurrency {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * A three letter string representing the ISO 4217 code for the currency. For example, USD, AUD, EUR, and so on. Click here for a list of supported currency codes.
   */
  Code?: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * The full name of the currency.
   */
  Name: string

  /**
   * One of, up to three custom fields for the transaction. Available for custom fields so configured for the company. Check Preferences.SalesFormsPrefs.CustomField and Preferences.VendorAndPurchasesPrefs.POCustomField for custom fields currenly configured. Click here to learn about managing custom fields.
   */
  CustomField?: CustomField

  /**
   * Indicates whether this currency is active in the company or not. true--This currency is active and enabled for use by QuickBooks. false--This currency is inactive, is hidden from most display purposes, and is not availble for use with financial transactions.
   * @filterable
   */
  Active?: boolean

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   * @filterable
   */
  MetaData?: ModificationMetaData
}
