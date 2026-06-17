import type {
  ReferenceType,
  CurrencyRef,
  BigDecimal,
  ModificationMetaData,
  PhysicalAddress,
  EmailAddress,
  TelephoneNumber,
  WebSiteAddress,
  ContactInfo,
  VendorPaymentBankDetail,
} from './common.type'

/**
 * Vendor Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Vendor {
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
   * Title of the person. This tag supports i18n, all locales. The DisplayName attribute or at least one of Title, GivenName, MiddleName, FamilyName, Suffix, or FullyQualifiedName attributes are required during create.
   */
  Title?: string

  /**
   * Given name or first name of a person. The DisplayName attribute or at least one of Title, GivenName, MiddleName, FamilyName, or Suffix attributes is required for object create.
   * @filterable
   */
  GivenName?: string

  /**
   * Middle name of the person. The person can have zero or more middle names. The DisplayName attribute or at least one of Title, GivenName, MiddleName, FamilyName, or Suffix attributes is required for object create.
   * @filterable
   */
  MiddleName?: string

  /**
   * Suffix of the name. For example, Jr. The DisplayName attribute or at least one of Title, GivenName, MiddleName, FamilyName, or Suffix attributes is required for object create.
   * @filterable
   */
  Suffix?: string

  /**
   * Family name or the last name of the person. The DisplayName attribute or at least one of Title, GivenName, MiddleName, FamilyName, or Suffix attributes is required for object create.
   * @filterable
   */
  FamilyName?: string

  /**
   * Primary email address.
   */
  PrimaryEmailAddr?: EmailAddress

  /**
   * The name of the vendor as displayed. Must be unique across all Vendor, Customer, and Employee objects. Cannot be removed with sparse update. If not supplied, the system generates DisplayName by concatenating vendor name components supplied in the request from the following list: Title, GivenName, MiddleName, FamilyName, and Suffix.
   * @filterable
   */
  DisplayName?: string

  /**
   * List of ContactInfo entities of any contact info type.
   */
  OtherContactInfo?: ContactInfo

  /**
   * Identifies the accounts payable account to be used for this supplier. Each supplier must have his own AP account. Applicable for France companies, only. Available when endpoint is evoked with the minorversion=3 query parameter. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for APAccountRef.value and APAccountRef.name, respectively.
   */
  APAccountRef?: ReferenceType

  /**
   * Reference to a default Term associated with this Vendor object. Query the Term name list resource to determine the appropriate Term object for this reference. Use Term.Id and Term.Name from that object for TermRef.value and TermRef.name, respectively.
   */
  TermRef?: ReferenceType

  /**
   * The Source type of the transactions created by QuickBooks Commerce. Valid values include: QBCommerce
   */
  Source?: string

  /**
   * GSTIN is an identification number assigned to every GST registered business.
   */
  GSTIN?: string

  /**
   * True if vendor is T4A eligible. Valid for CA locale
   */
  T4AEligible?: boolean

  /**
   * Fax number.
   */
  Fax?: TelephoneNumber

  /**
   * Also called, PAN (in India) is a code that acts as an identification for individuals, families and corporates, especially for those who pay taxes on their income.
   */
  BusinessNumber?: string

  /**
   * Reference to the currency in which all amounts associated with this vendor are expressed. Once set, it cannot be changed. If specified currency is not currently in the company's currency list, it is added. If not specified, currency for this vendor is the home currency of the company, as defined by Preferences.CurrencyPrefs.HomeCurrency. Read-only after object is created.
   */
  CurrencyRef?: CurrencyRef

  /**
   * Indicate if the vendor has TPAR enabled. TPAR stands for Taxable Payments Annual Report. The TPAR is mandated by ATO to get the details payments that businesses make to contractors for providing services. Some government entities also need to report the grants they have paid in a TPAR.
   */
  HasTPAR?: boolean

  /**
   * The method in which the supplier tracks their income. Applicable for France companies, only. Available when endpoint is evoked with the minorversion=3 query parameter. Valid values include: Cash and Accrual.
   */
  TaxReportingBasis?: string

  /**
   * Mobile phone number.
   */
  Mobile?: TelephoneNumber

  /**
   * Primary phone number.
   */
  PrimaryPhone?: TelephoneNumber

  /**
   * If true, this object is currently enabled for use by QuickBooks.
   * @filterable
   */
  Active?: boolean

  /**
   * Alternate phone number.
   */
  AlternatePhone?: TelephoneNumber

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * This vendor is an independent contractor; someone who is given a 1099-MISC form at the end of the year. A 1099 vendor is paid with regular checks, and taxes are not withheld on their behalf.
   */
  Vendor1099?: boolean

  /**
   * Pay rate of the vendor
   */
  CostRate?: BigDecimal

  /**
   * BillRate can be set to specify this vendor's hourly billing rate.
   */
  BillRate?: number

  /**
   * Website address.
   */
  WebAddr?: WebSiteAddress

  /**
   * True if vendor is T5018 eligible. Valid for CA locale
   */
  T5018Eligible?: boolean

  /**
   * The name of the company associated with the person or organization.
   * @filterable
   */
  CompanyName?: string

  /**
   * Vendor Payment Bank Detail.
   */
  VendorPaymentBankDetail?: VendorPaymentBankDetail

  /**
   * The tax ID of the Person or Organization. The value is masked in responses, exposing only last four characters. For example, the ID of 123-45-6789 is returned as XXXXXXX6789.
   */
  TaxIdentifier?: string

  /**
   * Name or number of the account associated with this vendor.
   */
  AcctNum?: string

  /**
   * For the filing of GSTR, transactions need to be classified depending on the type of vendor from whom the purchase is made. To facilitate this, we have introduced a new field as 'GST registration type'. Possible values are listed below:
   * GST_REG_REG GST registered- Regular. Customer who has a business which is registered under GST and has a GSTIN (doesn’t include customers registered under composition scheme, as an SEZ or as EOU's, STP's EHTP's etc.).
   * GST_REG_COMP GST registered-Composition. Customer who has a business which is registered under the composition scheme of GST and has a GSTIN.
   * GST_UNREG GST unregistered. Customer who has a business which is not registered under GST and does not have a GSTIN.
   * CONSUMER Consumer. Customer who is not registered under GST and is the final consumer of the service or product sold.
   * OVERSEAS Overseas. Customer who has a business which is located out of India.
   * SEZ SEZ. Customer who has a business which is registered under GST, has a GSTIN and is located in a SEZ or is a SEZ Developer.
   * DEEMED Deemed exports- EOU's, STP's EHTP's etc. Customer who has a business which is registered under GST and falls in the category of companies (EOU's, STP's EHTP's etc.), to which supplies are made they are termed as deemed exports.
   */
  GSTRegistrationType?: string

  /**
   * Name of the person or organization as printed on a check. If not provided, this is populated from DisplayName. Cannot be removed with sparse update.
   * @filterable
   */
  PrintOnCheckName?: string

  /**
   * Default billing address.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  BillAddr?: PhysicalAddress

  /**
   * Specifies the open balance amount or the amount unpaid by the customer. For the create operation, this represents the opening balance for the customer. When returned in response to the query request it represents the current open balance (unpaid amount) for that customer. Write-on-create, read-only otherwise.
   * @filterable
   */
  Balance?: number
}
