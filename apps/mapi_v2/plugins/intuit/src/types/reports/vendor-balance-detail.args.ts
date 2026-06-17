/**
 * VendorBalanceDetail Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface VendorBalanceDetailArgs {
  /**
   * Filters report contents based on term or terms supplied. Supported Values: One or more comma separated term IDs as returned in the attribute, Term.Id of the Term object response code.
   */
  term?: string

  /**
   * The range of dates over which receivables are due, in the format YYYY-MM-DD. start_duedate must be less than end_duedate. If not specified, all data is returned.
   */
  end_duedate?: string

  /**
   * The accounting method used in the report. Supported Values:Cash, Accrual
   */
  accounting_method?: string

  /**
   * Predefined date range. Use if you want the report to cover a standard report date range; otherwise, use the start_date and end_date to cover an explicit report date range. Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  date_macro?: string

  /**
   * The range of dates over which receivables are due, in the format YYYY-MM-DD. start_duedate must be less than end_duedate. If not specified, all data is returned.
   */
  start_duedate?: string

  /**
   * Predefined date range of due dates for balances to include in the report; otherwise, use the start_duedate and end_duedate to cover an explicit report date range. Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  duedate_macro?: string

  /**
   * The column type used in sorting report rows. Specify a column type as defined with the columns query parameter.
   */
  sort_by?: string

  /**
   * Start date to use for the report, in the format YYYY-MM-DD.
   */
  report_date?: string

  /**
   * The sort order. Supported Values: ascend, descend
   */
  sort_order?: string

  /**
   * Status of the balance. Supported Values: Paid, Unpaid, All
   */
  appaid?: string

  /**
   * Filters report contents to include information for specified departments if so configured in the company file. Supported Values: One or more comma separated department IDs as returned in the attribute, Department.Id of the Department object response code.
   */
  department?: string

  /**
   * Filters report contents to include information for specified vendors. Supported Values: One or more comma separated vendor IDs as returned in the attribute, Vendor.Id, of the Vendor object response code.
   */
  vendor?: string

  /**
   * Column types to be shown in the report. Supported Values: create_by, create_date, doc_num*, due_date*, last_mod_by, last_mod_date, memo*, term_name, tx_date*, txn_type*, vend_bill_addr, vend_comp_name, vend_name*, vend_pri_cont, vend_pri_email, vend_pri_tel
   * Additional columns with location tracking enabled: dept_name*
   */
  columns?: string
}
