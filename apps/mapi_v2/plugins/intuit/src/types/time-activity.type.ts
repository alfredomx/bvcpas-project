import type { ReferenceType, BigDecimal, ModificationMetaData } from './common.type'

/**
 * TimeActivity Entity
 * Extracted from official Intuit Developer documentation
 */
export interface TimeActivity {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * Enumeration of time activity types. Required in conjunction with either EmployeeRefor VendorRefattributes for create operations. Valid values: Vendoror Employee.
   */
  NameOf: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * The date for the time activity. This is the posting date that affects financial statements. If the date is not supplied, the current date on the server is used. Sort order is ASC by default. If you provide the StartTime and EndTime without including the timeZone offset, then you would need to pass the TxnDate for any historical or future dates. Lets say if you want to create a historical time activity then pass the TxnDate as the date and pass StartTime and EndTime as Hours without including the timeZone offset.
   * @filterable
   */
  TxnDate?: string

  /**
   * Hours and minutes of break taken between StartTime and EndTime. use when StartTime and EndTime are specified
   */
  'BreakHours BreakMinutes'?: number

  /**
   * Time that work ends. Required if Hours and Minutes not specified. Note: Kindly consider only the Hours without including the timeZone offset as it does not impact time activity hours calculation.
   * If TnxDate is provided then consider passing the StartTime and EndTime wihtout including the timeZone offset, then the the date passed on the TxnDate is used.
   * If TnxDate is NOT provided, passing the StartTime and EndTime with/wihtout including the timeZone offset, then the the current date on the server is used.
   * For any transactions with historical/future dates kindly include TxnDate in YYYY-MM-DD format and StartTime and EndTime in Hours and Minutes
   */
  EndTime?: string

  /**
   * Hours and minutes worked. Required if StartTime and EndTime not specified
   */
  Hours?: number

  /**
   * Specifies the vendor whose time is being recorded. Query the Vendor name list resource to determine the appropriate Vendor object for this reference. Use Vendor.Id and Vendor.Name from that object for VendorRef.value and VendorRef.name, respectively. Required if NameOf is set to Vendor
   */
  VendorRef?: ReferenceType

  /**
   * Reference to the Project ID associated with this transaction. Available with Minor Version 69 and above
   * @filterable
   */
  ProjectRef?: ReferenceType

  /**
   * Hourly bill rate of the employee or vendor for this time activity. Required if BillableStatus is set to Billable
   */
  HourlyRate?: number

  /**
   * Reference to a customer or job. Query the Customer name list resource to determine the appropriate Customer object for this reference. Use Customer.Id and Customer.DisplayName from that object for CustomerRef.value and CustomerRef.name, respectively. Required if BillableStatus is set to Billable
   */
  CustomerRef?: ReferenceType

  /**
   * Specifies the employee whose time is being recorded. Query the Employee name list resource to determine the appropriate Employee object for this reference. Use Employee.Id and Employee.DisplayName from that object for EmployeerRef.value and EmployeeRef.Name, respectively. Required if NameOf is set to Employee
   */
  EmployeeRef?: ReferenceType

  /**
   * Time that work starts. Required if Hours and Minutes not specified. Note: Kindly consider only the Hours without including the timeZone offset as it does not impact time activity hours calculation.
   * If TnxDate is provided then consider passing the StartTime and EndTime wihtout including the timeZone offset, then the the date passed on the TxnDate is used.
   * If TnxDate is NOT provided, passing the StartTime and EndTime with/wihtout including the timeZone offset, then the the current date on the server is used.
   * For any transactions with historical/future dates kindly include TxnDate in YYYY-MM-DD format and StartTime and EndTime in Hours and Minutes
   */
  StartTime?: string

  /**
   * Reference to the Class associated with this object. Available if Preferences.AccountingInfoPrefs.ClassTrackingPerTxn is set to true. Query the Class name list resource to determine the appropriate Class object for this reference. Use Class.Id and Class.Name from that object for ClassRef.value and ClassRef.name, respectively.
   */
  ClassRef?: ReferenceType

  /**
   * Description of work completed during time activity.
   */
  Description?: string

  /**
   * True if the time recorded is both billable and taxable.
   */
  Taxable?: boolean

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
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Pay rate of the employee or vendor for this time activity.
   */
  CostRate?: BigDecimal

  /**
   * Reference to the service item associated with this object. Query the Item name list resource, where Item.Type is set to Service, to determine the appropriate Item object for this reference. Use Item.Id and Item.Name from that object for ItemRef.value and ItemRef.name, respectively. For France locales: The account associated with the referenced Item object is looked up in the account category list.
   * If this account has same location as specified in the transaction by the TransactionLocationType attribute and the same VAT as in the line item TaxCodeRef attribute, then the item account is used.
   * If there is a mismatch, then the account from the account category list that matches the transaction location and VAT is used.
   * If this account is not present in the account category list, then a new account is created with the new location, new VAT code, and all other attributes as in the default account.
   */
  ItemRef?: ReferenceType

  /**
   * Specifies how much the employee should be paid for doing the work specified by the Compensation Id. Query the EmployeeCompensation resource to determine the appropriate PayrollCompensation object for an employee. Use EmployeeCompensation.Id and EmployerCompensation.Name from that object for PayrollItemRef.value and PayrollItemRef.name, respectively. This field is available only for a closed group of developers.
   */
  PayrollItemRef?: ReferenceType

  /**
   * Billable status of the time recorded. This field is not updatable through an API request. The value automatically changes when an invoice is created. Valid values: Billable, NotBillable, HasBeenBilled. You cannot directly update the status to HasBeenBilled. To set the status to HasBeenBilled, create an Invoice object and attach this TimeActivity object as a linked transaction to that Invoice.
   * @filterable
   */
  BillableStatus?: string

  /**
   * A reference to a Department object specifying the location of this object. Available if Preferences.AccountingInfoPrefs.TrackDepartments is set to true.
   * Query the Department name list resource to determine the appropriate department object for this reference. Use Department.Id and Department.Name from that object for DepartmentRef.value and DepartmentRef.name, respectively.
   */
  DepartmentRef?: ReferenceType

  /**
   * Unique identifier for this object.
   * @filterable
   */
  id?: string
}
