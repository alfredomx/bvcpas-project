/**
 * AccountListDetail Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface AccountListDetailArgs {
  /**
   * Account type from which transactions are included in the report.
   * Supported Values: AccountsPayable, AccountsReceivable, Bank, CostOfGoodsSold, CreditCard, Equity, Expense, FixedAsset, Income, LongTermLiability, NonPosting, OtherAsset, OtherCurrentAsset, OtherCurrentLiability, OtherExpense, OtherIncome
   */
  account_type?: string

  /**
   * The start date and end date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range.
   */
  end_date?: string

  /**
   * If not specified value of moddate_macro is used. (Account List Detail) Specify an explicit account modification report date range, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use the moddate_macro to cover a standard report date range.
   */
  start_moddate?: string

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
   * Predefined report account modification date range. Use if you want the report to cover a standard report date range when accounts were modified; otherwise, use the start_moddate and end_moddate to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  moddate_macro?: string

  /**
   * If not specified value of moddate_macro is used. (Account List Detail) Specify an explicit account modification report date range, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use the moddate_macro to cover a standard report date range.
   */
  end_moddate?: string

  /**
   * The account status. Supported values include: Deleted, Not_Deleted
   */
  account_status?: string

  /**
   * Predefined report account create date range. Use if you want the report to cover a standard create report date range; otherwise, use start_createdate and end_createdate to cover an explicit report date range.
   * Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  createdate_macro?: string

  /**
   * The start date and end date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range.
   */
  start_date?: string

  /**
   * Column types to be shown in the report.
   * Supported Values:
   * account_name*, account_type*, detail_acc_type, create_date, create_by, detail_acc_type*, last_ mod_date, last_ mod_by, account_desc*, account_bal*
   */
  columns?: string
}
