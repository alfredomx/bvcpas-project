import type { ReferenceType, IdType, ModificationMetaData } from './common.type'

/**
 * Item Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Item {
  /**
   * Unique Identifier for an Intuit entity (object). Required for the update operation.
   * @filterable
   */
  Id: IdType

  /**
   * Classification that specifies the use of this item. Applicable for France companies, only. Available when endpoint is evoked with the minorversion=3 query parameter. Read-only after object is created. Valid values include: Product and Service.
   */
  ItemCategoryType?: string

  /**
   * Name of the item. This value must be unique, at least one character in length, and cannot include tabs, new lines, or colons. Required for create.
   * @filterable
   */
  Name: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * Date of opening balance for the inventory transaction. For read operations, the date returned in this field is always the originally provided inventory start date. For update operations, the date supplied is interpreted as the inventory adjust date, is stored as such in the underlying data model, and is reflected in the QuickBooks Online UI for the object. The inventory adjust date is not exposed for read operations through the API. Required for Inventory type items.
   */
  InvStartDate: string

  /**
   * Classification that specifies the use of this item. See the description at the top of the Item entity page for details about supported item types. For requests with minor versions earlier than 4 specified, this field is read-only and system-defined as follows:
   * Inventory--Default setting when TrackQtyOnHand, InvStartDate, and AssetAccountRef are specified. Used for goods the company sells and buys that are tracked as inventory.
   * Service--Default setting when TrackQtyOnHand, InvStartDate, and AssetAccountRef are not specified. Used for non-tangible goods the company sells and buys that are not tracked as inventory. For example, specialized labor, consulting hours, and professional fees.
   * For requests with minor version=4 query parameter, this field is required to be explicitly set with one of the following:
   * Inventory--Used for goods the company sells and buys that are tracked as inventory.
   * Service--Used for non-tangible goods the company sells and buys that are not tracked as inventory. For example, specialized labor, consulting hours, and professional fees.
   * NonInventory--Use for goods the company sells and buys that are not tracked as inventory. For example, office supplies or goods bought on behalf of the customer.
   * When querying Item objects with minor versions earlier than 4 specified, NonInventory types are returned as type Service. For French locales, Type is tied with ItemCategoryType: if ItemCategoryType is set to Service, then Type is set to Service, if ItemCategoryType is Product, then Type is set to NonInventory. >Required when minor version 4 is specified.
   * @filterable
   */
  Type: string

  /**
   * Current quantity of the Inventory items available for sale. Not used for Service or NonInventory type items.Required for Inventory type items.
   */
  QtyOnHand: number

  /**
   * Reference to the Inventory Asset account that tracks the current value of the inventory. If the same account is used for all inventory items, the current balance of this account will represent the current total value of the inventory. Must be an account with account type of Other Current Asset. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for AssetAccountRef.value and AssetAccountRef.name, respectively. Required for Inventory item types.
   */
  AssetAccountRef: ReferenceType

  /**
   * The stock keeping unit (SKU) for this Item. This is a company-defined identifier for an item or product used in tracking inventory.
   * @filterable
   */
  Sku?: string

  /**
   * True if the sales tax is included in the item amount, and therefore is not calculated for the transaction.
   */
  SalesTaxIncluded?: boolean

  /**
   * True if there is quantity on hand to be tracked. Once this value is true, it cannot be updated to false. Applicable for items of type Inventory. Not applicable for Service or NonInventory item types.
   */
  TrackQtyOnHand?: boolean

  /**
   * Reference to the sales tax code for the Sales item. Applicable to Service and Sales item types only. Query the TaxCode name list resource to determine the appropriate TaxCode object for this reference. Use TaxCode.Id and TaxCode.Name from that object for SalesTaxCodeRef.value and SalesTaxCodeRef.name, respectively.
   */
  SalesTaxCodeRef?: ReferenceType

  /**
   * Reference to the Class for the item. Query the Class name list resource to determine the appropriate object for this reference. Use Class.Id and Class.Name from that object for ClassRef.value and ClassRef.name, respectively.
   */
  ClassRef?: ReferenceType

  /**
   * The Source type of the transactions created by QuickBooks Commerce. Valid values include: QBCommerce
   */
  Source?: string

  /**
   * True if the purchase tax is included in the item amount, and therefore is not calculated for the transaction.
   */
  PurchaseTaxIncluded?: boolean

  /**
   * Description of the item.
   */
  Description?: string

  /**
   * Sales tax abatement rate for India locales.
   */
  AbatementRate?: number

  /**
   * true--The object is a sub-category. false--The object is a top-level category (default). Sub-categories can be nested to a maximum depth of three levels below a top-level category. Required if this is a sub-category object.
   */
  SubItem?: boolean

  /**
   * If true, transactions for this item are taxable. Applicable to US companies, only.
   */
  Taxable?: boolean

  /**
   * Text to be displayed on customer's invoice to denote the Unit of Measure (instead of the standard code).
   */
  UQCDisplayText?: string

  /**
   * The minimum quantity of a particular inventory item that you need to restock at any given time. The ReorderPoint value cannot be set to null for sparse updates(sparse=true). It can be set to null only for full updates.
   */
  ReorderPoint?: number

  /**
   * Purchase description for the item.
   */
  PurchaseDesc?: string

  /**
   * Descriptive information about the entity. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Reference to the preferred vendor of this item. Query the Vendor name list resource to determine the appropriate object for this reference. Use Vendor.Id and Vendor.Name from that object for ParentRef.value and ParentRef.name, respectively.
   */
  PrefVendorRef?: ReferenceType

  /**
   * If true, the object is currently enabled for use by QuickBooks.
   * @filterable
   */
  Active?: boolean

  /**
   * Id of Standard Unit of Measure (UQC:Unique Quantity Code) of the item according to GST rule. UQCId should be one of the following ids:
   */
  UQCId?: string

  /**
   * Sales tax reverse charge rate for India locales.
   */
  ReverseChargeRate?: number

  /**
   * Reference to the purchase tax code for the item. Applicable to Service, Other Charge, and Product (Non-Inventory) item types. Query the TaxCode name list resource to determine the appropriate TaxCode object for this reference. Use TaxCode.Id and TaxCode.Name from that object for PurchaseTaxCodeRef.value and PurchaseTaxCodeRef.name, respectively.
   */
  PurchaseTaxCodeRef?: ReferenceType

  /**
   * Sales tax service type for India locales.
   */
  ServiceType?: string

  /**
   * Amount paid when buying or ordering the item, as expressed in the home currency.
   */
  PurchaseCost?: number

  /**
   * The immediate parent of the sub item in the hierarchical Item:SubItem list. If SubItem is true, then ParenRef is required. If SubItem is true, then ParenRef is required. Query the Item name list resource to determine the appropriate object for this reference. Use Item.Id and Item.Name from that object for ParentRef.value and ParentRef.name, respectively.
   */
  ParentRef?: ReferenceType

  /**
   * Corresponds to the Price/Rate column on the QuickBooks Online UI to specify either unit price, a discount, or a tax rate for item. If used for unit price, the monetary value of the service or product, as expressed in the home currency. If used for a discount or tax rate, express the percentage as a fraction. For example, specify 0.4 for 40% tax.
   * @sortable
   */
  UnitPrice?: number

  /**
   * Fully qualified name of the entity. The fully qualified name prepends the topmost parent, followed by each sub element separated by colons. Takes the form of Item:SubItem. Returned from an existing object and not input on a new object.Limited to 5 levels.
   * @filterable
   */
  FullyQualifiedName?: string

  /**
   * Reference to the expense account used to pay the vendor for this item. Must be an account with account type of Cost of Goods Sold. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for ExpenseAccountRef.value and ExpenseAccountRef.name, respectively. For France locales:
   * This is an optional field.
   * This is the purchase account id, If not provided it defaults to the default purchase account: 605100 and 601100 are the default expense accounts used for Service and Product type of item, respectively.
   * Required for Inventory, NonInventory, and Service item types.
   */
  ExpenseAccountRef: ReferenceType

  /**
   * Specifies the level of the hierarchy in which the object is located. First sub-category level below the top-most category is 1. Returned in the response body only when SubItem is set to true. Sub-categories can be nested to a maximum depth of three levels below a top-level category.
   */
  Level?: number

  /**
   * Reference to the posting account, that is, the account that records the proceeds from the sale of this item. Must be an account with account type of Sales of Product Income. Query the Account name list resource to determine the appropriate Account object for this reference. Use Account.Id and Account.Name from that object for IncomeAccountRef.value and IncomeAccountRef.name, respectively. For France locales:
   * This is an optional field.
   * This is the sales account id, If not provided it defaults to the default sales account: 706100 and 707100 are the default expense accounts used for Service and Product type of item, respectively.
   * Required for Inventory and Service item types.
   */
  IncomeAccountRef: ReferenceType

  /**
   * Tax classification segregates different items into different classifications and the tax classification is one of the key parameters to determine appropriate tax on transactions involving items. Tax classifications are sourced by either tax governing authorities as in India/Malaysia or externally like Exactor. 'Fuel', 'Garments' and 'Soft drinks' are a few examples of tax classification in layman terms. User can choose a specific tax classification for an item while creating it. A level 1 tax classification cannot be associated to an Item.
   */
  TaxClassificationRef?: ReferenceType
}
