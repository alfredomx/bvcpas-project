import type {
  ReferenceType,
  Sting,
  ModificationMetaData,
  EffectiveTaxRateData,
} from './common.type'

/**
 * TaxRate Entity
 * Extracted from official Intuit Developer documentation
 */
export interface TaxRate {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Value of the tax rate.
   */
  RateValue?: string

  /**
   * User recognizable name for the tax rate.
   * @filterable
   */
  Name: string

  /**
   * Reference to the tax agency associated with this object.
   * @filterable
   */
  AgencyRef?: ReferenceType

  /**
   * Special tax type to handle zero rate taxes. Used with VAT registered Businesses who receive goods/services (acquisitions) from other EU countries, will need to calculate the VAT due, but not paid, on these acquisitions. The rate of VAT payable is the same that would have been paid if the goods had been supplied by a UK supplier.
   */
  SpecialTaxType?: Sting

  /**
   * List of EffectiveTaxRate. An EffectiveTaxRate is used to know which taxrate is applicable on any date.
   */
  EffectiveTaxRate?: EffectiveTaxRateData

  /**
   * TaxRate DisplayType enum which acts as display config.
   */
  DisplayType?: Sting

  /**
   * Reference to the tax return line associated with this object.
   * @filterable
   */
  TaxReturnLineRef?: ReferenceType

  /**
   * If true, this object is currently enabled for use by QuickBooks.
   * @filterable
   */
  Active?: boolean

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * ID of the original tax rate from which the new tax rate is derived. Helps to understand the relationship between corresponding tax rate entities.
   */
  OriginalTaxRate?: string

  /**
   * User entered description for the tax rate.
   * @filterable
   */
  Description?: string
}
