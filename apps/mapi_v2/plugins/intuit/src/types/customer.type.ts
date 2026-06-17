import type {
  ReferenceType,
  CurrencyRef,
  ModificationMetaData,
  PhysicalAddress,
  EmailAddress,
  TelephoneNumber,
  WebSiteAddress,
} from './common.type'

/**
 * Customer Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Customer {
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
   * The name of the person or organization as displayed. Must be unique across all Customer, Vendor, and Employee objects. Cannot be removed with sparse update. If not supplied, the system generates DisplayName by concatenating customer name components supplied in the request from the following list: Title, GivenName, MiddleName, FamilyName, and Suffix.
   * @filterable
   */
  DisplayName?: string

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
   */
  Suffix?: string

  /**
   * Family name or the last name of the person. The DisplayName attribute or at least one of Title, GivenName, MiddleName, FamilyName, or Suffix attributes is required for object create.
   * @filterable
   */
  FamilyName?: string

  /**
   * Primary email address.
   * @filterable
   */
  PrimaryEmailAddr?: EmailAddress

  /**
   * Resale number or some additional info about the customer.
   */
  ResaleNum?: string

  /**
   * Also called UTR No. in ( UK ) , CST Reg No. ( IN ) also represents the tax registration number of the Person or Organization. This value is masked in responses, exposing only last five characters. For example, the ID of 123-45-6789 is returned as XXXXXX56789.
   */
  SecondaryTaxIdentifier?: string

  /**
   * Identifies the accounts receivable account to be used for this customer. Each customer must have his own AR account. Applicable for France companies, only. Available when endpoint is evoked with the minorversion=3 query parameter. Query the Account name list resource to determine the appropriate Account object for this reference, where Account.AccountType=Accounts Receivable. Use Account.Id and Account.Name from that object for ARAccountRef.value and ARAccountRef.name, respectively.
   */
  ARAccountRef?: ReferenceType

  /**
   * Reference to a default tax code associated with this Customer object. Reference is valid if Customer.Taxable is set to true; otherwise, it is ignored. If automated sales tax is enabled (Preferences.TaxPrefs.PartnerTaxEnabled is set to true) the default tax code is set by the system and can not be overridden. Query the TaxCode name list resource to determine the appropriate TaxCode object for this reference. Use TaxCode.Id and TaxCode.Name from that object for DefaultTaxCodeRef.value and DefaultTaxCodeRef.name, respectively.
   */
  DefaultTaxCodeRef?: ReferenceType

  /**
   * Preferred delivery method. Values are Print, Email, or None.
   */
  PreferredDeliveryMethod?: string

  /**
   * GSTIN is an identification number assigned to every GST registered business.
   */
  GSTIN?: string

  /**
   * Reference to a SalesTerm associated with this Customer object. Query the Term name list resource to determine the appropriate Term object for this reference. Use Term.Id and Term.Name from that object for SalesTermRef.value and SalesTermRef.name, respectively.
   */
  SalesTermRef?: ReferenceType

  /**
   * Reference to the customer type assigned to a customer. This field is only returned if the customer is assigned a customer type.
   */
  CustomerTypeRef?: string

  /**
   * Fax number.
   */
  Fax?: TelephoneNumber

  /**
   * Also called, PAN (in India) is a code that acts as an identification for individuals, families and corporates, especially for those who pay taxes on their income.
   */
  BusinessNumber?: string

  /**
   * If true, this Customer object is billed with its parent. If false, or null the customer is not to be billed with its parent. This attribute is valid only if this entity is a Job or sub Customer.
   */
  BillWithParent?: boolean

  /**
   * Reference to the currency in which all amounts associated with this customer are expressed. Once set, it cannot be changed. If specified currency is not currently in the company's currency list, it is added. If not specified, currency for this customer is the home currency of the company, as defined by Preferences.CurrencyPrefs.HomeCurrency.
   */
  CurrencyRef?: CurrencyRef

  /**
   * Mobile phone number.
   */
  Mobile?: TelephoneNumber

  /**
   * If true, this is a Job or sub-customer. If false or null, this is a top level customer, not a Job or sub-customer.
   */
  Job?: boolean

  /**
   * Cumulative open balance amount for the Customer (or Job) and all its sub-jobs. Cannot be written to QuickBooks.
   * @sortable
   */
  BalanceWithJobs?: number

  /**
   * Primary phone number.
   */
  PrimaryPhone?: TelephoneNumber

  /**
   * Date of the Open Balance for the create operation. Write-on-create.
   */
  OpenBalanceDate?: string

  /**
   * If true, transactions for this customer are taxable. Default behavior with minor version 10 and above: true, if DefaultTaxCodeRef is defined or false if TaxExemptionReasonId is set.
   */
  Taxable?: boolean

  /**
   * Alternate phone number.
   */
  AlternatePhone?: TelephoneNumber

  /**
   * Descriptive information about the entity. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * A reference to a Customer object that is the immediate parent of the Sub-Customer/Job in the hierarchical Customer:Job list. Required for the create operation if this object is a sub-customer or Job. Query the Customer name list resource to determine the appropriate Customer object for this reference. Use Customer.Id and Customer.DisplayName from that object for ParentRef.value and ParentRef.name, respectively.
   */
  ParentRef: ReferenceType

  /**
   * Free form text describing the Customer.
   */
  Notes?: string

  /**
   * Website address.
   */
  WebAddr?: WebSiteAddress

  /**
   * If true, this entity is currently enabled for use by QuickBooks. If there is an amount in Customer.Balance when setting this Customer object to inactive through the QuickBooks UI, a CreditMemo balancing transaction is created for the amount.
   * @filterable
   */
  Active?: boolean

  /**
   * The name of the company associated with the person or organization.
   * @filterable
   */
  CompanyName?: string

  /**
   * Specifies the open balance amount or the amount unpaid by the customer. For the create operation, this represents the opening balance for the customer. When returned in response to the query request it represents the current open balance (unpaid amount) for that customer. Write-on-create.
   * @filterable
   */
  Balance?: number

  /**
   * Default shipping address. If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  ShipAddr?: PhysicalAddress

  /**
   * Reference to a PaymentMethod associated with this Customer object. Query the PaymentMethod name list resource to determine the appropriate PaymentMethod object for this reference. Use PaymentMethod.Id and PaymentMethod.Name from that object for PaymentMethodRef.value and PaymentMethodRef.name, respectively.
   */
  PaymentMethodRef?: ReferenceType

  /**
   * If true, indicates this is a Project.
   */
  IsProject?: boolean

  /**
   * The Source type of the transactions created by QuickBooks Commerce. Valid values include: QBCommerce
   */
  Source?: string

  /**
   * Also called Tax Reg. No in ( UK ) , ( CA ) , ( IN ) , ( AU ) represents the tax ID of the Person or Organization. This value is masked in responses, exposing only last five characters. For example, the ID of 123-45-6789 is returned as XXXXXX56789.
   */
  PrimaryTaxIdentifier?: string

  /**
   * For the filing of GSTR, transactions need to be classified depending on the type of customer to whom the sale is done. To facilitate this, we have introduced a new field as 'GST registration type'. Possible values are listed below:
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
   * Name of the person or organization as printed on a check. If not provided, this is populated from DisplayName. Constraints: Cannot be removed with sparse update.
   * @filterable
   */
  PrintOnCheckName?: string

  /**
   * Default billing address. If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  BillAddr?: PhysicalAddress

  /**
   * Fully qualified name of the object. The fully qualified name prepends the topmost parent, followed by each sub element separated by colons. Takes the form of Customer:Job:Sub-job. System generated. Limited to 5 levels.
   * @filterable
   */
  FullyQualifiedName?: string

  /**
   * Specifies the level of the hierarchy in which the entity is located. Zero specifies the top level of the hierarchy; anything above will be level with respect to the parent. Constraints:up to 5 levels
   */
  Level?: number

  /**
   * The tax exemption reason associated with this customer object. Applicable if automated sales tax is enabled (Preferences.TaxPrefs.PartnerTaxEnabled is set to true) for the company. Set TaxExemptionReasonId: to one of the following:
   * Id	Reason
   * 1	Federal government
   * 2	State government
   * 3	Local government
   * 4	Tribal government
   * 5	Charitable organization
   * 6	Religious organization
   * 7	Educational organization
   * 8	Hospital
   * 9	Resale
   * 10	Direct pay permit
   * 11	Multiple points of use
   * 12	Direct mail
   * 13	Agricultural production
   * 14	Industrial production / manufacturing
   * 15	Foreign diplomat
   */
  TaxExemptionReasonId?: number // Numeric Id
}
