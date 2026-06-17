import type {
  ReferenceType,
  CurrencyRefType,
  MemoRef,
  BigDecimal,
  ModificationMetaData,
  CustomField,
  PhysicalAddress,
  EmailAddress,
  Line,
  LinkedTxn,
  TxnTaxDetail,
  DeliveryInfo,
  CreditCardPayment,
} from './common.type'

/**
 * SalesReceipt Entity
 * Extracted from official Intuit Developer documentation
 */
export interface SalesReceipt {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Individual line items of a transaction. Valid Line types include: SalesItemLine, GroupLine, DescriptionOnlyLine, DiscountLine and SubTotalLine (read-only). If the transaction is taxable there is a limit of 750 lines per transaction.
   */
  Line?: Line[]

  /**
   * Reference to a customer or job. Query the Customer name list resource to determine the appropriate Customer object for this reference. Use Customer.Id and Customer.DisplayName from that object for CustomerRef.value and CustomerRef.name, respectively.
   * @filterable
   */
  CustomerRef?: ReferenceType

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Identifies the address where the goods are shipped from. For transactions without shipping, it represents the address where the sale took place.
   * If automated sales tax is enabled (Preferences.TaxPrefs.PartnerTaxEnabled is set to true) and automated tax calculations are being used, this field is required for an accurate sales tax calculation.
   * For international addresses - countries should be passed as 3 ISO alpha-3 characters or the full name of the country.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  ShipFromAddr?: PhysicalAddress

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
   * Reference to the Project ID associated with this transaction. Available with Minor Version 69 and above
   * @filterable
   */
  ProjectRef?: ReferenceType

  /**
   * Identifies the e-mail address where the invoice is sent. Required if EmailStatus=NeedToSend
   */
  BillEmail?: EmailAddress

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
   * Location of the transaction, as defined using location tracking in QuickBooks Online.
   */
  ShipDate?: string

  /**
   * Shipping provider's tracking number for the delivery of the goods associated with the transaction.
   */
  TrackingNum?: string

  /**
   * Reference to the Class associated with the transaction. Available if Preferences.AccountingInfoPrefs.ClassTrackingPerTxn is set to true. Query the Class name list resource to determine the appropriate Class object for this reference. Use Class.Id and Class.Name from that object for ClassRef.value and ClassRef.name, respectively.
   */
  ClassRef?: ReferenceType

  /**
   * Printing status of the invoice. Valid values: NotSet, NeedToPrint, PrintComplete .
   */
  PrintStatus?: string

  /**
   * The reference number for the payment received. For example,  Check # for a check, envelope # for a cash donation.
   */
  PaymentRefNum?: string

  /**
   * Used internally to specify originating source of a credit card transaction.
   */
  TxnSource?: string

  /**
   * Zero or more related transactions to this sales receipt object. The following linked relationships are supported:
   * Links to Estimate and TimeActivity objects can be established directly to this sales receipt object with UI or with the API. Create, Read, Update, and Query operations are avaialble at the API level for these types of links.
   * Only one link can be made to an Estimate.
   * Links to expenses incurred on behalf of the customer are returned in the response with LinkedTxn.TxnType set to ReimburseCharge, ChargeCredit or StatementCharge corresponding to billable customer expenses of type Cash, Delayed Credit, and Delayed Charge, respectively. Links to these types of transactions are established within the QuickBooks UI, only, and are available as read-only at the API level.
   * Links to payments applied to an sales receipt object are returned in the response with LinkedTxn.TxnType set to Payment. Links to Payment transactions are established within the QuickBooks UI, only, and are available as read-only at the API level.
   * Links the sales receipt to refundReceipt objects that are applied to the sales receipt. Returned in the response if linkedTxnTxnType is a refundReceipt. Note that linking sales receipts to refund receipts can only be done via the customer-facing QuickBooks UI. This is only available as read-only via our API
   * Use LinkedTxn.TxnId as the ID in a separate read request for the specific resource to retrieve details of the linked object.
   */
  LinkedTxn?: LinkedTxn[]

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
   * If false or null, calculate the sales tax first, and then apply the discount. If true, subtract the discount first and then calculate the sales tax. Default Value: false Constraints: US versions of QuickBooks only.
   */
  ApplyTaxAfterDiscount?: boolean

  /**
   * Reference number for the transaction. If not explicitly provided at create time, this field is populated based on the setting of Preferences:CustomTxnNumber as follows:
   * If Preferences:CustomTxnNumber is true a custom value can be provided. If no value is supplied, the resulting DocNumber is null.
   * If Preferences:CustomTxnNumber is false, resulting DocNumber is system generated by incrementing the last number by 1.
   * If Preferences:CustomTxnNumber is false then do not send a value as it can lead to unwanted duplicates. If a DocNumber value is sent for an Update operation, then it just updates that particular invoice and does not alter the internal system DocNumber.
   * Note: DocNumber is an optional field for all locales except France. For France locale if Preferences:CustomTxnNumber is enabled it will not be automatically generated and is a required field.
   * @filterable
   */
  DocNumber?: string

  /**
   * User entered, organization-private note about the transaction. This note does not appear on the transaction form to the customer. This field maps to the Memo field on the Sales Receipt form.
   */
  PrivateNote?: string

  /**
   * Account to which payment money is deposited. Query the Account name list resource to determine the appropriate Account object for this reference, where Account.AccountType is Other Current Asset or Bank. Use Account.Id and Account.Name from that object for DepositToAccountRef.value and DepositToAccountRef.name, respectively.
   * If you do not specify this account, payment is applied to the Undeposited Funds account.
   */
  DepositToAccountRef?: ReferenceType

  /**
   * User-entered message to the customer; this message is visible to end user on their transactions.
   */
  CustomerMemo?: MemoRef

  /**
   * Email status of the receipt. Valid values: NotSet, NeedToSend, EmailSent .
   */
  EmailStatus?: string

  /**
   * Information about a credit card payment for the transaction. Used when PaymentType is CreditCard. Inject with data only if the payment was transacted through Intuit Payments API.
   */
  CreditCardPayment?: CreditCardPayment

  /**
   * This element provides information for taxes charged on the transaction as a whole. It captures the details sales taxes calculated for the transaction based on the tax codes referenced by the transaction. This can be calculated by QuickBooks business logic or you may supply it when adding a transaction. See Global tax model for more information about this element. If sales tax is disabled (Preferences.TaxPrefs.UsingSalesTax is set to false) then TxnTaxDetail is ignored and not stored.
   */
  TxnTaxDetail?: TxnTaxDetail

  /**
   * Reference to a PaymentMethod associated with this transaction. Query the PaymentMethod name list resource to determine the appropriate PaymentMethod object for this reference. Use PaymentMethod.Id and PaymentMethod.Name from that object for PaymentMethodRef.value and PaymentMethodRef.name, respectively.
   */
  PaymentMethodRef?: ReferenceType

  /**
   * The number of home currency units it takes to equal one unit of currency specified by CurrencyRef. Applicable if multicurrency is enabled for the company.
   */
  ExchangeRate?: number

  /**
   * Identifies the address where the goods must be shipped. If ShipAddris not specified, and a default Customer:ShippingAddr is specified in QuickBooks for this customer, the default ship-to address will be used by QuickBooks.
   * For international addresses - countries should be passed as 3 ISO alpha-3 characters or the full name of the country.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  ShipAddr?: PhysicalAddress

  /**
   * A reference to a Department object specifying the location of the transaction. Available if Preferences.AccountingInfoPrefs.TrackDepartments is set to true.
   * Query the Department name list resource to determine the appropriate department object for this reference. Use Department.Id and Department.Name from that object for DepartmentRef.value and DepartmentRef.name, respectively.
   */
  DepartmentRef?: ReferenceType

  /**
   * Reference to the ShipMethod associated with the transaction. There is no shipping method list. Reference resolves to a string.
   */
  ShipMethodRef?: ReferenceType

  /**
   * Bill-to address of the Invoice. If BillAddris not specified, and a default Customer:BillingAddr is specified in QuickBooks for this customer, the default bill-to address is used by QuickBooks.
   * For international addresses - countries should be passed as 3 ISO alpha-3 characters or the full name of the country.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  BillAddr?: PhysicalAddress

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Convenience field containing the amount in Balance expressed in terms of the home currency. Calculated by QuickBooks business logic. Value is valid only when CurrencyRef is specified and available when endpoint is evoked with the minorversion=3 query parameter. Applicable if multicurrency is enabled for the company
   */
  HomeBalance?: number

  /**
   * Email delivery information. Returned when a request has been made to deliver email with the send operation.
   */
  DeliveryInfo?: DeliveryInfo

  /**
   * A reference to the Recurring Transaction. It captures what recurring transaction template the SalesReceipt was created from.
   */
  RecurDataRef?: ReferenceType

  /**
   * Indicates the total amount of the transaction. This includes the total of all the charges, allowances, and taxes. Calculated by QuickBooks business logic; any value you supply is over-written by QuickBooks. If you process a linked refund transaction against a specific transaction, the totalAmt value won't change. It will remain the same. However, voiding the linked refund will change the totalAmt value to O.
   * @filterable
   */
  TotalAmt?: BigDecimal

  /**
   * The balance reflecting any payments made against the transaction. Initially set to the value of TotalAmt. A Balance of 0 indicates the invoice is fully paid. Calculated by QuickBooks business logic; any value you supply is over-written by QuickBooks.
   * @filterable
   */
  Balance?: number

  /**
   * Total amount of the transaction in the home currency. Includes the total of all the charges, allowances and taxes. Calculated by QuickBooks business logic. Value is valid only when CurrencyRef is specified. Applicable if multicurrency is enabled for the company
   */
  HomeTotalAmt?: number

  /**
   * Denotes how ShipAddr is stored: formatted or unformatted. The value of this flag is system defined based on format of shipping address at object create time.
   * If set to false, shipping address is returned in a formatted style using City, Country, CountrySubDivisionCode, Postal code.
   * If set to true, shipping address is returned in an unformatted style using Line1 through Line5 attributes.
   */
  FreeFormAddress?: boolean

  /**
   * Unique identifier for this object.
   * @filterable
   */
  id?: string

  /**
   * Include and set to true to void an object.
   */
  sparse?: string
}
