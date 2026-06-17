/**
 * JournalReport Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface JournalReportArgs {
  /**
   * The end date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  end_date?: string

  /**
   * Predefined date range. Use if you want the report to cover a standard report date range; otherwise, use the start_date and end_date to cover an explicit report date range. Supported Values: Today, Yesterday, This Week, Last Week, This Week-to-date, Last Week-to-date, Next Week, Next 4 Weeks, This Month, Last Month, This Month-to-date, Last Month-to-date, Next Month, This Fiscal Quarter, Last Fiscal Quarter, This Fiscal Quarter-to-date, Last Fiscal Quarter-to-date, Next Fiscal Quarter, This Fiscal Year, Last Fiscal Year, This Fiscal Year-to-date, Last Fiscal Year-to-date, Next Fiscal Year
   */
  date_macro?: string

  /**
   * The column type used in sorting report rows. Specify a column type as defined with the columns query parameter.
   */
  sort_by?: string

  /**
   * The sort order. Supported Values: ascend, descend
   */
  sort_order?: string

  /**
   * The start date of the report, in the format YYYY-MM-DD. start_date must be less than end_date. Use if you want the report to cover an explicit date range; otherwise, use date_macro to cover a standard report date range. If not specified value of date_macro is used
   */
  start_date?: string

  /**
   * Default columns included in the report are denoted with *. Column types to be shown in the report. Supported Values: acct_num_with_extn*, account_name*, credit_amt*, create_by, create_date, debt_amt*, doc_num*, due_date*, is_ar_paid*, is_ap_paid*, item_name, journal_code_name*, last_mod_by, last_mod_date, memo*, name, neg_open_bal, paid_date*, pmt_mthd*, quantity, rate, tx_date*, txn_num*, txn_type*
   * To retrieve the account number (acct_num_with_extn) it's also needed to request the account name (account_name) in the same request.
   * The account number will only be returned if the company has enabled the 'enable account numbers' option in its Chart of Accounts preferences.
   */
  columns?: string
}
