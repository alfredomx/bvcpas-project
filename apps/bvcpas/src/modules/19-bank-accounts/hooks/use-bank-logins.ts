'use client'

import { useQuery } from '@tanstack/react-query'

import {
  listBankLogins,
  type BankLoginsListResponse,
  type ListBankLoginsParams,
} from '../api/bank-accounts.api'

export const BANK_LOGINS_QUERY_KEY = 'bank-logins'

export function useBankLogins(filters: ListBankLoginsParams = {}) {
  return useQuery<BankLoginsListResponse, Error>({
    queryKey: [BANK_LOGINS_QUERY_KEY, filters],
    queryFn: () => listBankLogins(filters),
  })
}
