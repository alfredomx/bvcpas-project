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
  TxnTaxDetail,
  CreditCardPayment,
  CheckPayment,
} from './common.type'

/**
 * RefundReceipt Entity
 * Extracted from official Intuit Developer documentation
 */
export interface RefundReceipt {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Accounts receivable asset account from which payment money is refunded. Query the Account name list resource to determine the appropriate Account object for this reference, where Account.AccountType is Other Current Asset or Bank. Use Account.Id and Account.Name from that object for DepositToAccountRef.value and DepositToAccountRef.name, respectively. CurrencyRefType Reference to the currency in which all amounts on the associated transaction are expressed. This must be defined if multicurrency is enabled for the company.
   * Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here.
   */
  DepositToAccountRef?: ReferenceType

  /**
   * Individual line items of a transaction. Valid Line types include: SalesItemLine, GroupLine, DescriptionOnlyLine, DiscountLine and SubTotalLine(read-only)
   */
  Line?: Line[]

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Reference to the currency in which all amounts on the associated transaction are expressed. This must be defined if multicurrency is enabled for the company. Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here. Required if multicurrency is enabled for the company.
   */
  CurrencyRef?: CurrencyRefType

  /**
   * The reference number for the payment received. For example, check # for a check, envelope # for a cash donation.
   * Provide when DepositToAccountRef references an Account object where Account.AccountType=Bank.
   * Required when PrintStatus is set to PrintComplete.
   * If PrintStatus is set to NeedToPrint, the system sets PaymentRefNum to To Print.
   */
  PaymentRefNum: string

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
   * Identifies the e-mail address where the invoice is sent. If EmailStatus=NeedToSend, BillEmailis a required input.
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
   * Reference to the Class associated with the transaction. Available if Preferences.AccountingInfoPrefs.ClassTrackingPerTxn is set to true. Query the Class name list resource to determine the appropriate Class object for this reference. Use Class.Id and Class.Name from that object for ClassRef.value and ClassRef.name, respectively.
   */
  ClassRef?: ReferenceType

  /**
   * Printing status of the invoice. Valid values: NotSet, NeedToPrint, PrintComplete .
   */
  PrintStatus?: string

  /**
   * Information about a check payment for the transaction. Used when PaymentType is Check.
   * @filterable
   */
  CheckPayment?: CheckPayment

  /**
   * The originating source of the credit card transaction. Used in eCommerce apps where credit card transactions are processed by a merchant account. When set to IntuitPayment, this transaction is inserted into a list of pending deposits to be automatically matched and reconciled with the merchant's account when the transactions made via QuickBooks Payments settle. Currently, the only supported value is IntuitPayment.
   */
  TxnSource?: string

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
   * Descriptive information about the entity. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Reference number for the transaction. If not explicitly provided at create time, this field is populated based on the setting of Preferences:CustomTxnNumber as follows:
   * If Preferences:CustomTxnNumber is true a custom value can be provided. If no value is supplied, the resulting DocNumber is null.
   * If Preferences:CustomTxnNumber is false, resulting DocNumber is system generated by incrementing the last number by 1.
   * Recommended best practice: check the setting of Preferences:CustomTxnNumber before setting DocNumber. If a duplicate DocNumber needs to be supplied, add the query parameter name/value pair, include=allowduplicatedocnum to the URI.
   * Note: DocNumber is an optional field for all locales except France. For France locale if Preferences:CustomTxnNumber is enabled it will not be automatically generated and is a required field.
   * Sort order is ASC by default.
   * @filterable
   */
  DocNumber?: string

  /**
   * User entered, organization-private note about the transaction. This note does not appear on the refund receipt to the customer. This field maps to the Memo field on the refund receipt form.
   */
  PrivateNote?: string

  /**
   * User-entered message to the customer; this message is visible to end user on their transaction.
   */
  CustomerMemo?: MemoRef

  /**
   * Information about a credit card payment for the transaction. Used when PaymentType is CreditCard. Inject with data only if the payment was transacted through Intuit Payments API.
   * @filterable
   */
  CreditCardPayment?: CreditCardPayment

  /**
   * Reference to a customer or job. Query the Customer name list resource to determine the appropriate Customer object for this reference. Use Customer.Id and Customer.DisplayName from that object for CustomerRef.value and CustomerRef.name, respectively.
   * @filterable
   */
  CustomerRef?: ReferenceType

  /**
   * This data type provides information for taxes charged on the transaction as a whole. It captures the details sales taxes calculated for the transaction based on the tax codes referenced by the transaction. This can be calculated by QuickBooks business logic or you may supply it when adding a transaction. See Global tax model for more information about this element. If sales tax is disabled (Preferences.TaxPrefs.UsingSalesTax is set to false) then TxnTaxDetail is ignored and not stored.
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
   * Valid values are Cash, Check, CreditCard, or Other.
   * @filterable
   */
  PaymentType?: string

  /**
   * Bill-to address of the Invoice. If BillAddris not specified, and a default Customer:BillingAddr is specified in QuickBooks for this customer, the default bill-to address is used by QuickBooks.
   * For international addresses - countries should be passed as 3 ISO alpha-3 characters or the full name of the country.
   * If a physical address is updated from within the transaction object, the QuickBooks Online API flows individual address components differently into the Line elements of the transaction response then when the transaction was first created:
   * Line1 and Line2 elements are populated with the customer name and company name.
   * Original Line1 through Line 5 contents, City, SubDivisionCode, and PostalCode flow into Line3 through Line5as a free format strings.
   */
  BillAddr?: PhysicalAddress

  /**
   * If false or null, calculate the sales tax first, and then apply the discount. If true, subtract the discount first and then calculate the sales tax. Default Value: false Constraints: US versions of QuickBooks only.
   */
  ApplyTaxAfterDiscount?: boolean

  /**
   * Convenience field containing the amount in Balance expressed in terms of the home currency. Calculated by QuickBooks business logic. Available when endpoint is evoked with the minorversion=3 query parameter. Applicable if multicurrency is enabled for the company
   */
  HomeBalance?: number

  /**
   * A reference to the Recurring Transaction. It captures what recurring transaction template the RefundReceipt was created from.
   */
  RecurDataRef?: ReferenceType

  /**
   * Indicates the total amount of the transaction. This includes the total of all the charges, allowances, and taxes. Calculated by QuickBooks business logic; any value you supply is over-written by QuickBooks.
   */
  TotalAmt?: BigDecimal

  /**
   * Reference to the TaxExepmtion ID associated with this object. Available for companies that have automated sales tax enabled.
   * TaxExemptionRef.Name: The Tax Exemption Id for the customer to which this object is associated. This Id is typically issued by the state.
   * TaxExemptionRef.value: The system-generated Id of the exemption type.
   * For internal use only.
   */
  TaxExemptionRef?: ReferenceType

  /**
   * The balance reflecting any payments made against the transaction. Initially set to the value of TotalAmt. Calculated by QuickBooks business logic; any value you supply is over-written by QuickBooks.
   * @filterable
   */
  Balance?: number

  /**
   * Total amount of the transaction in the home currency. Includes the total of all the charges, allowances and taxes. Calculated by QuickBooks business logic. Value is valid only when CurrencyRef is specified. Applicable if multicurrency is enabled for the company.
   */
  HomeTotalAmt?: number

  /**
   * Unique identifier for this object.
   * @filterable
   */
  id?: string
}
