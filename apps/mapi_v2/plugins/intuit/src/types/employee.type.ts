import type {
  BigDecimal,
  ModificationMetaData,
  PhysicalAddress,
  EmailAddress,
  TelephoneNumber,
} from './common.type'

/**
 * Employee Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Employee {
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
   * Represents the physical street address for this employee. If QuickBooks Payroll is enabled for the company, the following PhysicalAddress fields are required:
   * City, maximum of 255 chars
   * CountrySubDivisionCode, maximum of 255 chars
   * PostalCode
   * Required when QuickBooks Payroll is enabled.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  PrimaryAddr: PhysicalAddress

  /**
   * Primary email address.
   */
  PrimaryEmailAddr?: EmailAddress

  /**
   * The name of the person or organization as displayed. Default Value: If not supplied, the system generates DisplayName by concatenating employee name components supplied in the request from the following list: Title, GivenName, MiddleName, FamilyName, and Suffix. When QuickBooks Payroll is enabled, this attribute is read-only and a concatenation of GivenName, MiddleName, and FamilyName.
   * @filterable
   */
  DisplayName?: string

  /**
   * Title of the person. This tag supports i18n, all locale. Not supported when QuickBooks Payroll is enabled.
   */
  Title?: string

  /**
   * If true, this entity is currently enabled for use by QuickBooks.
   */
  BillableTime?: boolean

  /**
   * Given name or family name of a person. At least one of GivenName or FamilyName attributes is required.
   * @filterable
   */
  GivenName?: string

  /**
   * Birth date of the employee.
   */
  BirthDate?: string

  /**
   * Middle name of the person. The person can have zero or more middle names.
   * @filterable
   */
  MiddleName?: string

  /**
   * Social security number (SSN) of the employee. If SSN is set, it is masked in the response with XXX-XX-XXXX. If XXX-XX-XXXX is sent in the create or update request, XXX-XX-XXXX is ignored and the old value is preserved. This attribute cannot be passed in a request when QuickBooks Payroll is enabled. Code for this field must be removed before submitting.
   */
  SSN?: string

  /**
   * Primary phone number.
   */
  PrimaryPhone?: TelephoneNumber

  /**
   * If true, this entity is currently enabled for use by QuickBooks.
   * @filterable
   */
  Active?: boolean

  /**
   * Release date of the employee.
   */
  ReleasedDate?: string

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Pay rate of the employee
   */
  CostRate?: BigDecimal

  /**
   * Mobile phone number.
   */
  Mobile?: TelephoneNumber

  /**
   * Gender of the employee. To clear the gender value, set to Null in a full update request. Supported values include: Male or Female.
   */
  Gender?: string

  /**
   * Hire date of the employee.
   */
  HiredDate?: string

  /**
   * This attribute can only be set if BillableTime is true. Not supported when QuickBooks Payroll is enabled.
   */
  BillRate?: BigDecimal

  /**
   * true--the object represents an organization. false--the object represents a person.
   */
  Organization?: boolean

  /**
   * Suffix of the name. For example, Jr. Not supported when QuickBooks Payroll is enabled.
   * @filterable
   */
  Suffix?: string

  /**
   * Family name or the last name of the person. At least one of GivenName or FamilyName attributes is required.
   * @filterable
   */
  FamilyName?: string

  /**
   * Name of the person or organization as printed on a check. If not provided, this is populated from DisplayName. Cannot be removed with sparse update. Not supported when QuickBooks Payroll is enabled.
   * @filterable
   */
  PrintOnCheckName?: string

  /**
   * Specifies the ID number of the employee in the employer's directory.
   */
  EmployeeNumber?: string

  /**
   * Employee reference number. For internal use only.
   */
  V4IDPseudonym?: string
}
