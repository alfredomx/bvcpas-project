import type { ModificationMetaData } from './common.type'

/**
 * Preferences Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Preferences {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   */
  Id: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData
}
