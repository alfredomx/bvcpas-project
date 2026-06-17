/**
 * CustomerBalance Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface CustomerBalanceArgs {
  /**
   * Filters report contents to include information for specified customers.
   * Supported Values: One or more comma separated customer IDs as returned in the attribute, Customer.Id, of the Customer object response code.
   */
  customer?: string

  /**
   * The accounting method used in the report. Supported Values:Cash, Accrual
   */
  accounting_method?: string

  /**
   * Predefined date range. Use if you want the report to cover a standard report date range; otherwise, use the start_date and end_date to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  date_macro?: string

  /**
   * Supported Values:All, Paid, Unpaid
   */
  arpaid?: string

  /**
   * Start date to use for the report, in the format YYYY-MM-DD.
   */
  report_date?: string

  /**
   * The sort order.
   * Supported Values: ascend, descend
   */
  sort_order?: string

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
}
