import type { ModificationMetaData, CustomField } from './common.type'

/**
 * ExchangeRate Entity
 * Extracted from official Intuit Developer documentation
 */
export interface ExchangeRate {
  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Date on which this exchange rate was set.
   * @filterable
   */
  AsOfDate?: boolean

  /**
   * The source currency from which the exchange rate is specified, and usually. Specify as a three letter string representing the ISO 4217 code for the currency. For example, USD, AUD, EUR, and so on. For example, in the equation 65 INR = 1 USD, INR is the source currency.
   * @filterable
   */
  SourceCurrencyCode?: string

  /**
   * The exchange rate between SourceCurrencyCode and TargetCurrencyCode on the AsOfDate date.
   */
  Rate?: number

  /**
   * One of, up to three custom fields for the transaction. Available for custom fields so configured for the company. Check Preferences.SalesFormsPrefs.CustomField and Preferences.VendorAndPurchasesPrefs.POCustomField for custom fields currenly configured. Click here to learn about managing custom fields.
   */
  CustomField?: CustomField

  /**
   * The target currency against which the exchange rate is specified. Specify as a three letter string representing the ISO 4217 code for the currency. For example, USD, AUD, EUR, and so on. For example, in the equation 65 INR = 1 USD, USA is the target currency.
   */
  TargetCurrencyCode?: string

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   * @filterable
   */
  MetaData?: ModificationMetaData
}
