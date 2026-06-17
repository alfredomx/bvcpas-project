/**
 * TrialBalance Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface TrialBalanceArgs {
  /**
   * The accounting method used in the report. Supported Values:Cash, Accrual
   */
  accounting_method?: string

  /**
   * The end date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  end_date?: string

  /**
   * Predefined date range. Use if you want the report to cover a standard report date range; otherwise, use the start_date and end_date to cover an explicit report date range. Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  date_macro?: string

  /**
   * The sort order. Supported Values: ascend, descend
   */
  sort_order?: string

  /**
   * The criteria by which to group the report results. Supported Values: Total, Month, Week, Days, Quarter, Year, Customers, Vendors, Classes, Departments, Employees, ProductsAndServices
   */
  summarize_column_by?: string

  /**
   * The start date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  start_date?: string
}
