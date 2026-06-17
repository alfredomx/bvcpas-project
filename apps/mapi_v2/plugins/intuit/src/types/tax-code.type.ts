import type { ModificationMetaData, TaxRateList } from './common.type'

/**
 * TaxCode Entity
 * Extracted from official Intuit Developer documentation
 */
export interface TaxCode {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * User recognizable name for the tax sales code.
   * @filterable
   */
  Name: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * List of references to tax rates that apply for purchase transactions when this tax code represents a group of tax rates. Required when TaxGroup is set to true
   */
  PurchaseTaxRateList: TaxRateList

  /**
   * List of references to tax rates that apply for sales transactions when this tax code represents a group of tax rates. Required when TaxGroup is set to true
   */
  SalesTaxRateList: TaxRateList

  /**
   * true—-this object represents a group of one or more tax rates. false—-this object represents pseudo-tax codes TAX and NON.
   */
  TaxGroup?: boolean

  /**
   * False or null means meaning non-taxable. True means taxable. Always true, except for the pseudo taxcode NON.
   */
  Taxable?: boolean

  /**
   * False if inactive. Inactive sales tax codes may be hidden from display and may not be used on financial transactions.
   * @filterable
   */
  Active?: boolean

  /**
   * User entered description for the sales tax code.
   * @filterable
   */
  Description?: string

  /**
   * Read-only. Denotes whether active tax codes are displayed on transactions. true—-This tax code is hidden on transactions. false—-This tax code is displayed on transactions.
   */
  Hidden?: boolean

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Flag to identify whether the TaxCode is system defined by Automated Sales Tax engine or user generated. Valid values include USER_DEFINED, SYSTEM_GENERATEDSYSTEM_GENERATED.
   */
  TaxCodeConfigType?: string
}
