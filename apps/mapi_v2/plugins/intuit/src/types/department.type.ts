import type { ReferenceType, ModificationMetaData } from './common.type'

/**
 * Department Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Department {
  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * User recognizable name for the Department.
   */
  Name: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * The immediate parent of the SubDepartment. Required for the create operation if this object is a SubDepartment. Required if this object is a subdepartment.
   */
  ParentRef?: ReferenceType

  /**
   * If true, this entity is currently enabled for use by QuickBooks. If set to false, this entity is not available.
   * @filterable
   */
  Active?: boolean

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   * @filterable
   */
  MetaData?: ModificationMetaData

  /**
   * Fully qualified name of the entity. The fully qualified name prepends the topmost parent, followed by each sub element separated by colons. Takes the form of Parent:Department1:SubDepartment1:SubDepartment2. Limited to 5 levels.
   * @filterable
   */
  FullyQualifiedName?: string

  /**
   * Specifies whether this Department object is a SubDepartment. true--SubDepartment. false or null--top-level Department.
   * @sortable
   */
  SubDepartment?: boolean
}
