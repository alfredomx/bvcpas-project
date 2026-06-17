/**
 * GeneralLedger Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface GeneralLedgerArgs {
  /**
   * Filters report contents to include information for specified customers.
   * Supported Values: One or more comma separated customer IDs as returned in the attribute, Customer.Id, of the Customer object response code.
   */
  customer?: string

  /**
   * Filters report contents to include information for specified accounts.
   * Supported Values: One or more comma separated account IDs as returned in the attribute, Account.Id, of the Account object response code.
   */
  account?: string

  /**
   * The accounting method used in the report. Supported Values:Cash, Accrual
   */
  accounting_method?: string

  /**
   * Filters report contents to include information for specified source accounts.
   * Supported Values: One or more comma separated account IDs as returned in the attribute, Account.Id, of the Account object response code.
   */
  source_account?: string

  /**
   * The end date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  end_date?: string

  /**
   * Predefined date range. Use if you want the report to cover a standard report date range; otherwise, use the start_date and end_date to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  date_macro?: string

  /**
   * (source_account_type) Account type from which transactions are included in the report.
   * Supported Values: AccountsPayable, AccountsReceivable, Bank, CostOfGoodsSold, CreditCard, Equity, Expense, FixedAsset, Income, LongTermLiability, NonPosting, OtherAsset, OtherCurrentAsset, OtherCurrentLiability, OtherExpense, OtherIncome
   */
  account_type?: string

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
   * The start date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  start_date?: string

  /**
   * The criteria by which to group the report results.
   * Supported Values: Total, Month, Week, Days, Quarter, Year, Customers, Vendors, Classes, Departments, Employees, ProductsAndServices
   */
  summarize_column_by?: string

  /**
   * Filters report contents to include information for specified departments if so configured in the company file.
   * Supported Values: One or more comma separated department IDs as returned in the attribute, Department.Id of the Department object response code.
   */
  department?: string

  /**
   * Filters report contents to include information for specified vendors.
   * Supported Values: One or more comma separated vendor IDs as returned in the attribute, Vendor.Id, of the Vendor object response code.
   */
  vendor?: string

  /**
   * Filters report contents to include information for specified classes if so configured in the company file.
   * Supported Values: One or more comma separated class IDs as returned in the attribute, Class.Id, of the Class entity response code.
   */
  class?: string

  /**
   * Column types to be shown in the report.
   * Supported Values: account_name, chk_print_state, create_by, create_date, cust_name, doc_num*, emp_name, inv_date, is_adj*, is_ap_paid, is_ar_paid, is_cleared, item_name, last_mod_by, last_mod_date, memo*, name*, quantity, rate, split_acc*, tx_date*, txn_type*, vend_name.
   * Additional columns when sales tax enabled: net_amount, tax_amount, tax_code.
   * Additional columns when sales tax enabled: net_amount, tax_amount, tax_code
   * Additional columns when account numbering enabled: account_num.
   * Additional columns when class tracking enabled: klass_name*.
   * Additional columns when location tracking enabled: dept_name*.
   * Multicurrency is enabled for the company if Preferences.MultiCurrencyEnabled is set to true. Read more about multicurrency support here.
   * NonTracking status is enabled for the company if CompanyInfo.NameValue.Name.NonTracking is set to true. Currently enabled for Canadian company, other locales can be added in the future.
   */
  columns?: string
}
