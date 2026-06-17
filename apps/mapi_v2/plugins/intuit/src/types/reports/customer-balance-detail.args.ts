/**
 * CustomerBalanceDetail Report Argument
 * Extracted from official Intuit Developer documentation
 */
export interface CustomerBalanceDetailArgs {
  /**
   * Filters report contents to include information for specified customers.
   * Supported Values: One or more comma separated customer IDs as returned in the attribute, Customer.Id, of the Customer object response code.
   */
  customer?: string

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
   * The range of dates over which receivables are due, in the format YYYY-MM-DD. start_duedate must be less than end_duedate. If not specified, all data is returned.
   */
  start_duedate?: string

  /**
   * Filter by the specified custom field as defined by the CustomField attribute in transaction entities where supported.
   * Supported Values: Name of custom field.
   */
  custom1?: string

  /**
   * The column type used in sorting report rows. Specify a column type as defined with the columns query parameter.
   */
  sort_by?: string

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
   * The date upon which aging is determined.
   * Supported Values:Report_Date, Current
   */
  aging_method?: string

  /**
   * Filters report contents to include information for specified departments if so configured in the company file.
   * Supported Values: One or more comma separated department IDs as returned in the attribute, Department.Id of the Department object response code.
   */
  department?: string

  /**
   * Column types to be shown in the report.
   * Supported Values: bill_addr, create_by, create_date, cust_bill_email, cust_comp_name, cust_msg, cust_phone_other, cust_tel, cust_name, deliv_addr, doc_num*, due_date*, last_mod_by, last_mod_date, memo*, sale_sent_state, ship_addr, ship_date, ship_via, term_name, tracking_num, tx_date*, txn_type*
   * Additional columns with custom fields enabled: sales_cust1, sales_cust2, sales_cust3
   * Additional columns with location tracking enabled: dept_name*
   */
  columns?: string
}
