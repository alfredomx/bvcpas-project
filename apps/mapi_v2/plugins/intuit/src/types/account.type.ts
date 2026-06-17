import type { ReferenceType, CurrencyRef, ModificationMetaData } from './common.type'

/**
 * Account Entity
 * Extracted from official Intuit Developer documentation
 */
export interface Account {
  /**
   * DetailType of the account in QuickBooks Online.
   */
  detailType?: string

  /**
   * Default name of the account.
   */
  name?: string

  /**
   * Default accountAlias for account.
   */
  accountAlias?: string

  /**
   * Account starting with this number falls under this category.
   */
  number?: string

  /**
   * If true, account creation for this category is not allowed.
   */
  nonPosting?: boolean

  /**
   * If true, the system allows account created under this category to be associated with TxnLocationType.
   */
  purchSaleLocationRequired?: boolean

  /**
   * Default location for account created.
   */
  defaultPurchSaleLocation?: string

  /**
   * Default TaxCode associated with the account.
   */
  defaultTaxCode?: string

  /**
   * If true, opening balance can be set for these accounts.
   */
  canSetOpeningBalance?: boolean

  /**
   * If true, the system allows a VAT code to be associated with this account.
   */
  vatCodeRequired?: boolean

  /**
   * If true, the system allows a JournalCode object to be associated with this account.
   */
  journalCodeRequired?: boolean

  /**
   * Accounts created under this category can be associated with particular type of item. For example, if Array contains PRODUCT then the account created can be associated with item of type PRODUCT only.
   */
  itemCategoryType?: any[]

  /**
   * includedTxnApplicableSet
   */
  includedTxnApplicableSet?: any[]

  /**
   * includedTxnApplicableSet
   */
  excludedTxnApplicableSet?: any[]

  /**
   * includedTxnApplicableSet
   */
  bankAccountFilterTypes?: any[]

  /**
   * Unique identifier for this object. Sort order is ASC by default.
   * @filterable
   */
  Id: string

  /**
   * User recognizable name for the Account. Account.Name attribute must not contain double quotes (") or colon (:).
   * @filterable
   */
  Name: string

  /**
   * Version number of the object. It is used to lock an object for use by one app at a time. As soon as an application modifies an object, its SyncToken is incremented. Attempts to modify an object specifying an older SyncToken fails. Only the latest version of the object is maintained by QuickBooks Online.
   */
  SyncToken?: string

  /**
   * User-defined account number to help the user in identifying the account within the chart-of-accounts and in deciding what should be posted to the account. The Account.AcctNum attribute must not contain colon (:).
   * Name must be unique.
   * For French Locales:
   * Length must be between 6 and 20 characters
   * Must start with the account number from the master category list.
   * Name limited to alpha-numeric characters.
   * Max length for Account.AcctNum:
   * AU & CA: 20 characters.
   * US, UK & IN: 7 characters
   */
  AcctNum?: string

  /**
   * Reference to the currency in which this account holds amounts.
   */
  CurrencyRef?: CurrencyRef

  /**
   * Specifies the Parent AccountId if this represents a SubAccount.
   * @filterable
   */
  ParentRef?: ReferenceType

  /**
   * User entered description for the account, which may include user entered information to guide bookkeepers/accountants in deciding what journal entries to post to the account.
   * @filterable
   */
  Description?: string

  /**
   * Whether or not active inactive accounts may be hidden from most display purposes and may not be posted to.
   * @filterable
   */
  Active?: boolean

  /**
   * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
   */
  MetaData?: ModificationMetaData

  /**
   * Specifies whether this object represents a parent (false) or subaccount (true). Please note that accounts of these types - OpeningBalanceEquity, UndepositedFunds, RetainedEarnings, CashReceiptIncome, CashExpenditureExpense, ExchangeGainOrLoss cannot have a sub account and cannot be a sub account of another account.
   * @filterable
   */
  SubAccount?: boolean

  /**
   * The classification of an account. Not supported for non-posting accounts. Valid values include: Asset, Equity, Expense, Liability, Revenue
   * @filterable
   */
  Classification?: string

  /**
   * Fully qualified name of the object; derived from Name and ParentRef. The fully qualified name prepends the topmost parent, followed by each subaccount separated by colons and takes the form of Parent:Account1:SubAccount1:SubAccount2. System generated. Limited to 5 levels.
   * @filterable
   */
  FullyQualifiedName?: string

  /**
   * The account location. Valid values include:
   * WithinFrance
   * FranceOverseas
   * OutsideFranceWithEU
   * OutsideEU
   * For France locales, only.
   */
  TxnLocationType?: string

  /**
   * A detailed account classification that specifies the use of this account. The type is based on the Classification.
   * Required if AccountSubType is not specified.
   * @filterable
   */
  AccountType?: string

  /**
   * Specifies the cumulative balance amount for the current Account and all its sub-accounts.
   * @filterable
   */
  CurrentBalanceWithSubAccounts?: number

  /**
   * A user friendly name for the account. It must be unique across all account categories. For France locales, only. For example, if an account is created under category 211 with AccountAlias of Terrains, then the system does not allow creation of an account with same AccountAlias of Terrains for any other category except 211. In other words, 211001 and 215001 accounts cannot have same AccountAlias because both belong to different account category. For France locales, only.
   */
  AccountAlias?: string

  /**
   * Reference to the default tax code used by this account. Tax codes are referenced by the TaxCode.Id in the TaxCode object. Available when endpoint is invoked with the minorversion=3 query parameter. For global locales, only. Required for France locales
   */
  TaxCodeRef: ReferenceType

  /**
   * The account sub-type classification and is based on the AccountType value.
   * Required if AccountType is not specified.
   * @filterable
   */
  AccountSubType?: string

  /**
   * Specifies the balance amount for the current Account. Valid for Balance Sheet accounts.
   * @filterable
   */
  CurrentBalance?: number
}
