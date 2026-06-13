'use client'

import { useQuery } from '@tanstack/react-query'

import {
  getBankLogin,
  type BankLoginDetail,
} from '../api/bank-accounts.api'

export const BANK_LOGIN_QUERY_KEY = 'bank-login'

export function useBankLogin(credentialId: string | null | undefined) {
  return useQuery<BankLoginDetail, Error>({
    queryKey: [BANK_LOGIN_QUERY_KEY, credentialId],
    queryFn: () => getBankLogin(credentialId as string),
    enabled: Boolean(credentialId),
  })
}
