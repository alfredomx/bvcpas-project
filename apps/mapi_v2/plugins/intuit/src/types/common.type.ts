/**
 * Shared Reference Type for Intuit API entities
 * Used to link to other entities (e.g., ParentRef, CurrencyRef).
 */
export interface ReferenceType {
  value: string
  name?: string
  type?: string
}

export type CurrencyRef = ReferenceType
export type CurrencyRefType = ReferenceType
export type AttachableRef = ReferenceType

export type IdType = string
export type MemoRef = string
export type BigDecimal = number
export type Sting = string

/** Metadata containing creation and modification timestamps. */
export interface ModificationMetaData {
  CreateTime?: string
  LastUpdatedTime?: string
}

/** Custom Field representation used across various entities. */
export interface CustomField {
  DefinitionId: string
  Name: string
  Type: string
  StringValue?: string
  BooleanValue?: boolean
  DateValue?: string
  NumberValue?: number
}

/** Represents a physical address (e.g. billing or shipping). */
export interface PhysicalAddress {
  Id?: string
  Line1?: string
  Line2?: string
  Line3?: string
  Line4?: string
  Line5?: string
  City?: string
  Country?: string
  CountryCode?: string
  CountrySubDivisionCode?: string
  PostalCode?: string
  PostalCodeExt?: string
  Lat?: string
  Long?: string
}

/** Represents an email address. */
export interface EmailAddress {
  Address?: string
}

/** Represents a telephone number. */
export interface TelephoneNumber {
  FreeFormNumber?: string
}

/** Represents a website address. */
export interface WebSiteAddress {
  URI?: string
}

/** Represents a Line item in a transaction. */
export interface Line {
  Id?: string
  LineNum?: number
  Description?: string
  Amount?: number
  DetailType?: string
  [key: string]: any
}

/** Represents a reference to a linked transaction. */
export interface LinkedTxn {
  TxnId?: string
  TxnType?: string
  TxnLineId?: string
}

/** Represents tax detail for a transaction. */
export interface TxnTaxDetail {
  DefaultTaxCodeRef?: ReferenceType
  TxnTaxCodeRef?: ReferenceType
  TotalTax?: number
  TaxLine?: Line[]
}

export interface DeliveryInfo {
  DeliveryType?: string
  DeliveryTime?: string
}

export interface ContactInfo {
  Type?: string
  Telephone?: TelephoneNumber
  Email?: EmailAddress
}

export interface CreditCardPayment {
  CreditChargeInfo?: any
  CreditChargeResponse?: any
}

export interface CheckPayment {
  CheckNum?: string
  Status?: string
  NameOnAcct?: string
  AcctNum?: string
  BankName?: string
}

export interface BillPaymentCheck {
  BankAccountRef?: ReferenceType
  PrintStatus?: string
  CheckDetail?: CheckPayment
}

export interface BillPaymentCreditCard {
  CCAccountRef?: ReferenceType
  CCDetail?: CreditCardPayment
}

export interface CashBackInfo {
  AccountRef?: ReferenceType
  Amount?: number
  Memo?: string
}

export type EffectiveTaxRateData = any[]
export type TaxRateDetails = any[]
export type TaxRateList = any
export type VendorPaymentBankDetail = any
