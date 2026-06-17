/**
 * TransactionList Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface TransactionListArgs {
  /**
   * Predefined date range. Use if you want the report to cover a standard report date range; otherwise, use the start_date and end_date to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year, This Calendar Quarter, This Calendar Quarter-to-date, Last Calendar Quarter, Last Calendar Quarter-to-date, Next Calendar Quarter, This Calendar Year, This Calendar Year-to-date, Last Calendar Year, Last Calendar Year-to-date, Next Calendar Year
   */
  date_macro?: string

  /**
   * Filters report contents based on payment method.
   * Supported Values: Cash, Check, Dinners Club, American Express, Discover, MasterCard, Visa, Credit Card
   */
  payment_method?: string

  /**
   * Predefined date range of due dates for balances to include in the report; otherwise, use the start_duedate and end_duedate to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  duedate_macro?: string

  /**
   * Supported Values:All, Paid, Unpaid
   */
  arpaid?: string

  /**
   * Filters report contents to include information for specified transaction amount. For example, bothamount=1233.45 limits report contents to transactions of amount 1233.45.
   */
  bothamount?: string

  /**
   * Filters report contents based transaction type. Supported values include:
   * CreditCardCharge, Check, Invoice, ReceivePayment, JournalEntry, Bill, CreditCardCredit, VendorCredit, Credit, BillPaymentCheck, BillPaymentCreditCard, Charge, Transfer, Deposit, Statement, BillableCharge, TimeActivity, CashPurchase, SalesReceipt, CreditMemo, CreditRefund, Estimate, InventoryQuantityAdjustment, PurchaseOrder, GlobalTaxPayment, GlobalTaxAdjustment, Service Tax Refund, Service Tax Gross Adjustment, Service Tax Reversal, Service Tax Defer, Service Tax Partial Utilisation
   */
  transaction_type?: string

  /**
   * Filters report contents to include information for specified transaction number, as found in the docnum parameter of the transaction object.
   */
  docnum?: string

  /**
   * (Account List Detail) Specify an explicit account modification report date range, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use the moddate_macro to cover a standard report date range.
   */
  start_moddate?: string

  /**
   * Account type from which transactions are included in the report.
   * Supported Values: AccountsPayable, AccountsReceivable, Bank, CostOfGoodsSold, CreditCard, Equity, Expense, FixedAsset, Income, LongTermLiability, NonPosting, OtherAsset, OtherCurrentAsset, OtherCurrentLiability, OtherExpense, OtherIncome
   */
  source_account_type?: string

  /**
   * The field in the transaction by which to group results. Supported Values: Name, Account, Transaction Type, Customer, Vendor, Employee, Location, Payment Method, Day, Week, Month, Quarter, Year, Fiscal Year, Fiscal Quarter, None
   */
  group_by?: string

  /**
   * The start date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  start_date?: string

  /**
   * Filters report contents to include information for specified departments if so configured in the company file.
   * Supported Values: One or more comma separated department IDs as returned in the attribute, Department.Id of the Department object response code.
   */
  department?: string

  /**
   * The range of dates over which receivables are due, in the format YYYY-MM-DD. start_duedate must be less than end_duedate. If not specified, all data is returned.
   */
  start_duedate?: string

  /**
   * Column types to be shown in the report.
   * Supported Values: account_name*, create_by, create_date, cust_msg, due_date, doc_num*, inv_date, is_ap_paid, is_cleared, is_no_post*, last_mod_by, memo*, name*, other_account*, pmt_mthd, printed, sales_cust1, sales_cust2, sales_cust3, term_name, tracking_num, tx_date*, txn_type*, term_name, is_adj, last_mod_date, ship_via, olb_status, extra_doc_num, is_ar_paid
   * Additional columns when location tracking enabled: dept_name*
   * Additional columns with location tracking enabled: dept_name*
   * Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here.
   */
  columns?: string

  /**
   * The range of dates over which receivables are due, in the format YYYY-MM-DD. start_duedate must be less than end_duedate. If not specified, all data is returned.
   */
  end_duedate?: string

  /**
   * Filters report contents to include information for specified vendors.
   * Supported Values: One or more comma separated vendor IDs as returned in the attribute, Vendor.Id, of the Vendor object response code.
   */
  vendor?: string

  /**
   * The end date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  end_date?: string

  /**
   * Filters report contents to include information for specified memo.
   * Supported Values: One or more comma separated memo IDs.
   */
  memo?: string

  /**
   * Status of the balance.
   * Supported Values: Paid, Unpaid, All
   */
  appaid?: string

  /**
   * Predefined report account modification date range. Use if you want the report to cover a standard report date range when accounts were modified; otherwise, use the start_moddate and end_moddate to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  moddate_macro?: string

  /**
   * Filters report contents based on whether checks are printed or not.
   * Supported Values: Printed, To_be_printed
   */
  printed?: string

  /**
   * Predefined report account create date range. Use if you want the report to cover a standard create report date range; otherwise, use start_createdate and end_createdate to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  createdate_macro?: string

  /**
   * Filters report contents to include information for specified check status.
   * Supported Values:
   * Cleared: The transaction has been processed by a bank or credit card account and is reflected in the bank balance.
   * Uncleared: A financial entry that has not been reconciled or matched with the corresponding bank statement records.
   * Reconciled: The transaction has been compared to original records and verified as correct.
   * Deposited: A deposit was made into a bank account, such as a checking account.
   */
  cleared?: string

  /**
   * Filters report contents to include information for specified customers.
   * Supported Values: One or more comma separated customer IDs as returned in the attribute, Customer.Id, of the Customer object response code.
   */
  customer?: string

  /**
   * Specifies whether Quick Zoom URL information should be generated for rows in the report. Quick Zoom URL is a hyperlink to another report containing further details about the particular column of data.
   * Supported Values: true, false
   */
  qzurl?: string

  /**
   * Filters report contents based on term or terms supplied.
   * Supported Values: One or more comma separated term IDs as returned in the attribute, Term.Id of the Term object response code.
   */
  term?: string

  /**
   * Specify an explicit account create report date range, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use createdate_macro to cover a standard report date range. (This field is not currently available.)
   */
  end_createdate?: string

  /**
   * Filters report contents based on the specified comma separated list of ids for the name list customer, vendor, or employee objects.
   * Query the Customer, Vendor, or Employee name list resource to determine the list of objects for this reference. Specify values found in Customer.Id, Vendor.Id, and Employee.Id. For example, name=1,4,7 includes data in the report for namelist ids 1, 4, and 7. vendor and employee objects
   */
  name?: string

  /**
   * The column type used in sorting report rows. Specify a column type as defined with the columns query parameter.
   */
  sort_by?: string

  /**
   * The sort order.
   * Supported Values: ascend, descend
   */
  sort_order?: string

  /**
   * Specify an explicit account create report date range, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use createdate_macro to cover a standard report date range. (This field is not currently available.)
   */
  start_createdate?: string

  /**
   * (Account List Detail) Specify an explicit account modification report date range, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use the moddate_macro to cover a standard report date range.
   */
  end_moddate?: string
}
