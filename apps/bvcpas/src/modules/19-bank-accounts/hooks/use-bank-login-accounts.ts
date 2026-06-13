'use client'

import { useQuery } from '@tanstack/react-query'

import {
  listBankAccounts,
  type BankAccountsListResponse,
} from '../api/bank-accounts.api'

export const BANK_LOGIN_ACCOUNTS_QUERY_KEY = 'bank-login-accounts'

export function useBankLoginAccounts(
  credentialId: string | null | undefined,
) {
  return useQuery<BankAccountsListResponse, Error>({
    queryKey: [BANK_LOGIN_ACCOUNTS_QUERY_KEY, credentialId],
    queryFn: () => listBankAccounts(credentialId as string),
    enabled: Boolean(credentialId),
  })
}
