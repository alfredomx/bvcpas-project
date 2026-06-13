import type { BankAccountType } from '../api/bank-accounts.api'

export const ACCOUNT_TYPE_LABEL: Record<BankAccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
  loan: 'Loan',
  other: 'Other',
}

export const ACCOUNT_TYPES: readonly BankAccountType[] = [
  'checking',
  'savings',
  'credit_card',
  'loan',
  'other',
] as const
