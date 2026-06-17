import type { AttachableRef, IdType, ModificationMetaData } from './common.type'

/**
 * Attachable Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Attachable {
  /**
   * Unique Identifier for an Intuit entity (object). Required for the update operation.
   * @filterable
   */
  Id: IdType

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * FileName of the attachment. Required for file attachments.
   * @filterable
   */
  FileName: string

  /**
   * The note is either related to the attachment specified with the FileName attribute, or as a standalone note. Required for note attachments.
   * @filterable
   */
  Note: string

  /**
   * Category of the attachment. Valid values include (case sensitive): Contact Photo, Document, Image, Receipt, Signature, Sound, Other.
   * @filterable
   */
  Category?: string

  /**
   * ContentType of the attachment. Returned for file attachments.
   * @filterable
   */
  ContentType?: string

  /**
   * PlaceName from where the attachment was requested.
   * @filterable
   */
  PlaceName?: string

  /**
   * Specifies the transaction object to which this attachable file is to be linked.
   */
  AttachableRef?: AttachableRef

  /**
   * Longitude from where the attachment was requested.
   * @filterable
   */
  Long?: string

  /**
   * Tag name for the requested attachment.
   * @filterable
   */
  Tag?: string

  /**
   * Latitude from where the attachment was requested.
   * @filterable
   */
  Lat?: string

  /**
   * Descriptive information about the entity. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * FullPath FileAccess URI of the attachment. Returned for file attachments.
   */
  FileAccessUri?: string

  /**
   * Size of the attachment. Returned for file attachments.
   * @filterable
   */
  Size?: number

  /**
   * FullPath FileAccess URI of the attachment thumbnail if the attachment file is of a content type with thumbnail support. Returned for file attachments.
   */
  ThumbnailFileAccessUri?: string

  /**
   * TempDownload URI which can be directly downloaded by clients. Returned for file attachments.
   */
  TempDownloadUri?: string

  /**
   * Thumbnail TempDownload URI which can be directly downloaded by clients. This is only available if the attachment file is of a content type with thumbnail support. Returned for file attachments.
   * @filterable
   */
  ThumbnailTempDownloadUri?: string
}
