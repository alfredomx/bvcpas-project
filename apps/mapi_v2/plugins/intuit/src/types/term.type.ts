import type { ModificationMetaData } from './common.type'

/**
 * Term Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Term {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * User recognizable name for the term. For example, Net 30.
   * @filterable
   */
  Name: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Discount percentage available against an amount if paid within the days specified by DiscountDays.
   */
  DiscountPercent?: number

  /**
   * Discount applies if paid within this number of days. Used only when DueDays is specified.
   */
  DiscountDays?: number

  /**
   * If true, this entity is currently enabled for use by QuickBooks.
   * @filterable
   */
  Active?: boolean

  /**
   * Type of the Sales Term. Valid values: STANDARD--Used if DueDays is not null. DATE_DRIVEN--Used if DueDays is null.
   */
  Type?: string

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Payment must be received by this day of the month. Used only if DueDays is not specified. Required if DueDays not present
   */
  DayOfMonthDue?: number

  /**
   * Discount applies if paid before this day of month. Required if DueDays not present
   */
  DiscountDayOfMonth?: number // Positive Integer

  /**
   * Payment due next month if issued that many days before the DayOfMonthDue. Required if DueDays not present.
   */
  DueNextMonthDays?: number // Positive Integer

  /**
   * Number of days from delivery of goods or services until the payment is due. Required if DayOfMonthDue not present
   */
  DueDays?: number
}
