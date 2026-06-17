/**
 * APAgingDetail Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface APAgingDetailArgs {
  /**
   * Filter by the shipping method as stored in Invoice.ShipMethodRef.Name.
   * Supported Values: Any shipping method as sent in the Invoice.ShipMethodRef.Name attribute at Invoice create- or update-time.
   */
  shipvia?: string

  /**
   * Filters report contents based on term or terms supplied.
   * Supported Values: One or more comma separated term IDs as returned in the attribute, Term.Id of the Term object response code.
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
   * The range of dates over which receivables are due, in the format YYYY-MM-DD. start_duedate must be less than end_duedate. If not specified, all data is returned.
   */
  start_duedate?: string

  /**
   * Filter by the specified custom field as defined by the CustomField attribute in transaction entities where supported.
   * Supported Values: Name of custom field.
   */
  custom1?: string

  /**
   * Filter by the specified custom field as defined by the CustomField attribute in transaction entities where supported.
   * Supported Values: Name of custom field.
   */
  custom2?: string

  /**
   * Filter by the specified custom field as defined by the CustomField attribute in transaction entities where supported.
   * Supported Values: Name of custom field.
   */
  custom3?: string

  /**
   * Start date to use for the report, in the format YYYY-MM-DD.
   */
  report_date?: string

  /**
   * The number of periods to be shown in the report.
   * Supported Values: A numeric value.
   */
  num_periods?: number

  /**
   * Filters report contents to include information for specified vendors.
   * Supported Values: One or more comma separated vendor IDs as returned in the attribute, Vendor.Id, of the Vendor object response code.
   */
  vendor?: string

  /**
   * Filters report contents based on minimum days past due.
   * Supported Values: Integer number of days. no filtering
   */
  past_due?: number

  /**
   * The number of days in the aging period.
   * Supported Values: A numeric value.
   */
  aging_period?: number

  /**
   * Column types to be shown in the report.
   * Supported Values: create_by, create_date, doc_num*, due_date*, last_mod_by, last_mod_date, memo*, past_due*, term_name, tx_date*, txn_type*, vend_bill_addr, vend_comp_name, vend_name*, vend_pri_cont, vend_pri_email, vend_pri_tel
   * Additional columns with location tracking enabled: dept_name*
   */
  columns?: string
}
