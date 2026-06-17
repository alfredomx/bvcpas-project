/**
 * InventoryValuationSummary Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface InventoryValuationSummaryArgs {
  /**
   * Specifies whether Quick Zoom URL information should be generated for rows in the report. Quick Zoom URL is a hyperlink to another report containing further details about the particular column of data.
   * Supported Values: true, false
   */
  qzurl?: string

  /**
   * Predefined date range. Use if you want the report to cover a standard report date range; otherwise, use the start_date and end_date to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  date_macro?: string

  /**
   * Filters report contents to include information for specified items.
   * Supported Values: One or more comma separated item IDs as returned in the attribute, Item.Id,of the Item entity response code.
   */
  item?: string

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
}
