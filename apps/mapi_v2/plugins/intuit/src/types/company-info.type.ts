import type {
  ModificationMetaData,
  PhysicalAddress,
  EmailAddress,
  TelephoneNumber,
  WebSiteAddress,
} from './common.type'

/**
 * CompanyInfo Entity
 * Extracted from official Intuit Developer documentation
 */
export interface CompanyInfo {
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
   * The name of the company.
   */
  CompanyName?: string

  /**
   * Company Address as described in preference.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  CompanyAddr?: PhysicalAddress

  /**
   * Legal Address given to the government for any government communication.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  LegalAddr?: PhysicalAddress

  /**
   * Comma separated list of languages.
   */
  SupportedLanguages?: string

  /**
   * Country name to which the company belongs for financial calculations.
   */
  Country?: string

  /**
   * Default email address.
   */
  Email?: EmailAddress

  /**
   * Website address.
   */
  WebAddr?: WebSiteAddress

  /**
   * Any other preference not covered with the standard set of attributes. See Data Services Extensions, below, for special reserved name/value pairs. NameValue.Name--Name of the element. NameValue.Value--Value of the element.
   */
  NameValue?: any[] // NameValue pairs

  /**
   * The start month of fiscal year.
   */
  FiscalYearStartMonth?: string

  /**
   * Address of the company as given to their customer, sometimes the address given to the customer mail address is different from Company address. If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  CustomerCommunicationAddr?: PhysicalAddress

  /**
   * Primary phone number.
   */
  PrimaryPhone?: TelephoneNumber

  /**
   * The legal name of the company.
   */
  LegalName?: string

  /**
   * If your QuickBooks company has defined an EIN in company settings, this value is returned.
   */
  EmployerId?: string

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * DateTime when company file was created. This field and Metadata.CreateTimecontain the same value.
   */
  CompanyStartDate?: string
}
