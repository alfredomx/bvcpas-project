import type {
  ReferenceType,
  CurrencyRefType,
  BigDecimal,
  ModificationMetaData,
  CustomField,
  PhysicalAddress,
  EmailAddress,
  Line,
  LinkedTxn,
  TxnTaxDetail,
} from './common.type'

/**
 * PurchaseOrder Entity
 * Extracted from official Intuit Developer documentation
 */
export interface PurchaseOrder {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Specifies to which AP account the bill is credited. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for APAccountRef.value and APAccountRef.name, respectively. The specified account must have Account.Classification set to Liability and Account.AccountSubType set to AccountsPayable.
   * If the company has a single AP account, the account is implied. However, it is recommended that the AP Account be explicitly specified in all cases to prevent unexpected errors when relating transactions to each other.
   */
  APAccountRef?: ReferenceType

  /**
   * Reference to the vendor for this transaction. Query the Vendor name list resource to determine the appropriate Vendor object for this reference. Use Vendor.Id and Vendor.Name from that object for VendorRef.value and VendorRef.name, respectively.
   */
  VendorRef?: ReferenceType

  /**
   * Individual line items of a transaction. Valid Line types include: Item line. Note: The ItemRef in the ItemBasedExpenseLine below must reference an Item in QBO that has an expense account linked to it (e.g. in the ExpenseAccountRef field of the Item). Otherwise the request fails in QBO with a 'You must select an account for this transaction.' error.
   */
  Line?: Line[]

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Reference to the currency in which all amounts on the associated transaction are expressed. This must be defined if multicurrency is enabled for the company.
   * Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here. Required if multicurrency is enabled for the company
   */
  CurrencyRef?: CurrencyRefType

  /**
   * Method in which tax is applied. Allowed values are: TaxExcluded, TaxInclusive, and NotApplicable. Not applicable to US companies; required for non-US companies.
   */
  GlobalTaxCalculation?: string

  /**
   * The date entered by the user when this transaction occurred. For posting transactions, this is the posting date that affects the financial statements. If the date is not supplied, the current date on the server is used.
   * Sort order is ASC by default.
   * @filterable
   */
  TxnDate?: string

  /**
   * One of, up to three custom fields for the transaction. Available for custom fields so configured for the company. Check Preferences.SalesFormsPrefs.CustomField and Preferences.VendorAndPurchasesPrefs.POCustomField for custom fields currenly configured. Click here to learn about managing custom fields.
   */
  CustomField?: CustomField

  /**
   * Used to specify the vendor e-mail address where the purchase req is sent.
   */
  POEmail?: EmailAddress

  /**
   * Reference to the Class associated with the transaction. Available if Preferences.AccountingInfoPrefs.ClassTrackingPerTxn is set to true. Query the Class name list resource to determine the appropriate Class object for this reference. Use Class.Id and Class.Name from that object for ClassRef.value and ClassRef.name, respectively.
   */
  ClassRef?: ReferenceType

  /**
   * Reference to the sales term associated with the transaction. Query the Term name list resource to determine the appropriate Term object for this reference. Use Term.Id and Term.Name from that object for SalesTermRef.value and SalesTermRef.name, respectively.
   */
  SalesTermRef?: ReferenceType

  /**
   * Zero or more Bill objects linked to this purchase order; LinkedTxn.TxnType is set to Bill. To retrieve details of a linked Bill transaction, issue a separate request to read the Bill whose ID is linkedTxn.TxnId.
   */
  LinkedTxn?: LinkedTxn[]

  /**
   * A message for the vendor. This text appears on the Purchase Order object sent to the vendor.
   */
  Memo?: string

  /**
   * Purchase order status. Valid values are: Open and Closed.
   */
  POStatus?: string

  /**
   * The account location. Valid values include:
   * WithinFrance
   * FranceOverseas
   * OutsideFranceWithEU
   * OutsideEU
   * For France locales, only.
   */
  TransactionLocationType?: string

  /**
   * Date when the payment of the transaction is due. If date is not provided, the number of days specified in SalesTermRef added the transaction date will be used.
   * @filterable
   */
  DueDate?: string

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Reference number for the transaction. If not explicitly provided at create time, this field is populated based on the setting of Preferences:OtherPrefs:NameValue.Name = VendorAndPurchasesPrefs.UseCustomTxnNumbers as follows:
   * If Preferences:OtherPrefs:NameValue.Name = VendorAndPurchasesPrefs.UseCustomTxnNumbers is true a custom value can be provided. If no value is supplied, the resulting DocNumber is null.
   * If Preferences:OtherPrefs:NameValue.Name = VendorAndPurchasesPrefs.UseCustomTxnNumbers is false, resulting DocNumber is system generated by incrementing the last number by 1.
   * Throws an error when duplicate DocNumber is sent in the request. Recommended best practice: check the setting of Preferences:OtherPrefs:NameValue.Name = VendorAndPurchasesPrefs.UseCustomTxnNumbers before setting DocNumber. If a duplicate DocNumber needs to be supplied, add the query parameter name/value pair, include=allowduplicatedocnum to the URI. Sort order is ASC by default.
   * @filterable
   */
  DocNumber?: string

  /**
   * User entered, organization-private note about the transaction. This note does not appear on the purchase order to the vendor. This field maps to the Memo field on the Purchase Order form.
   */
  PrivateNote?: string

  /**
   * Reference to the user-defined ShipMethod associated with the transaction. Store shipping method string in both ShipMethodRef.value and ShipMethodRef.name.
   */
  ShipMethodRef?: ReferenceType

  /**
   * This data type provides information for taxes charged on the transaction as a whole. It captures the details sales taxes calculated for the transaction based on the tax codes referenced by the transaction. This can be calculated by QuickBooks business logic or you may supply it when adding a transaction. See Global tax model for more information about this element. If sales tax is disabled (Preferences.TaxPrefs.UsingSalesTax is set to false) then TxnTaxDetail is ignored and not stored.
   */
  TxnTaxDetail?: TxnTaxDetail

  /**
   * Reference to the customer to whose shipping address the order will be shipped to.
   */
  ShipTo?: ReferenceType

  /**
   * The number of home currency units it takes to equal one unit of currency specified by CurrencyRef. Applicable if multicurrency is enabled for the company.
   */
  ExchangeRate?: number

  /**
   * Address to which the vendor shipped or will ship any goods associated with the purchase.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  ShipAddr?: PhysicalAddress

  /**
   * Address to which the payment should be sent.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  VendorAddr?: PhysicalAddress

  /**
   * Email status of the purchase order. Valid values: NotSet, NeedToSend, EmailSent
   */
  EmailStatus?: string

  /**
   * Indicates the total amount of the transaction. This includes the total of all the charges, allowances, and taxes. Calculated by QuickBooks business logic; any value you supply is over-written by QuickBooks.
   */
  TotalAmt?: BigDecimal

  /**
   * A reference to the Recurring Transaction. It captures what recurring transaction template the PurchaseOrder was created from.
   */
  RecurDataRef?: ReferenceType

  /**
   * Unique identifier for this object.
   * @filterable
   */
  id?: string
}
