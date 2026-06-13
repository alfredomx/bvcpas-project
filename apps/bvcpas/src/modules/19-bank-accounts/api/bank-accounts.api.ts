// Wrappers sobre los endpoints del módulo bank-worker de mapi.
//
// Endpoints cubiertos:
//   - GET    /v1/banking/credentials                                    (lista global)
//   - GET    /v1/banking/credentials/:credentialId                      (detalle)
//   - POST   /v1/banking/credentials                                    (crear)
//   - PATCH  /v1/banking/credentials/:credentialId                      (editar)
//   - DELETE /v1/banking/credentials/:credentialId                      (borrar)
//   - GET    /v1/banking/credentials/:credentialId/accounts             (accounts dentro)
//   - POST   /v1/banking/credentials/:credentialId/accounts             (crear account)
//   - PATCH  /v1/banking/accounts/:accountId                            (editar account)
//   - POST   /v1/banking/accounts/:accountId/status                     (cambiar status)
//   - DELETE /v1/banking/accounts/:accountId                            (borrar account)
//   - GET    /v1/banking/portals                                        (catálogo)
//
// Naming snake_case 1:1 con el backend en los responses (legal_name,
// portal_url, account_mask, etc.). Bodies usan camelCase porque así
// los declaran los DTOs de mapi (clientId, bankPortalId).

import { api } from '@/lib/api/client'
import type { components, paths } from '@/lib/api/schema'

// ─── Tipos derivados del SDK ──────────────────────────────────────

export type BankLoginsListResponse = components['schemas']['ListGlobalCredentialsResponseDto']
export type BankLogin = BankLoginsListResponse['items'][number]
export type BankLoginDetail = components['schemas']['GlobalCredentialResponseDto']
export type BankLoginStatus = BankLogin['status']

export type BankAccountsListResponse = components['schemas']['BankAccountListResponseDto']
export type BankAccount = BankAccountsListResponse['data'][number]
export type BankAccountDetail = components['schemas']['BankAccountResponseDto']
export type BankAccountStatus = BankAccount['status']
export type BankAccountType = BankAccount['account_type']

export type BankPortalsListResponse = components['schemas']['BankPortalListResponseDto']
export type BankPortal = BankPortalsListResponse['data'][number]

export type CreateBankLoginBody = components['schemas']['CreateGlobalCredentialDto']
// El PATCH global del credential reusa el mismo body del PATCH anidado.
export type UpdateBankLoginBody = components['schemas']['UpdateClientBankAccountDto']
export type CreateBankAccountBody = components['schemas']['CreateBankAccountDto']
export type UpdateBankAccountBody = components['schemas']['UpdateBankAccountDto']
export type ChangeBankAccountStatusBody = components['schemas']['ChangeBankAccountStatusDto']

export type ListBankLoginsParams = NonNullable<
  paths['/v1/banking/credentials']['get']['parameters']['query']
>

// ─── Bank Logins ──────────────────────────────────────────────────

export async function listBankLogins(
  params?: ListBankLoginsParams,
): Promise<BankLoginsListResponse> {
  const { data, error } = await api.GET('/v1/banking/credentials', {
    params: { query: params ?? {} },
  })
  if (error) throw error
  if (!data) throw new Error('listBankLogins: empty response')
  return data
}

export async function getBankLogin(credentialId: string): Promise<BankLoginDetail> {
  const { data, error } = await api.GET('/v1/banking/credentials/{credentialId}', {
    params: { path: { credentialId } },
  })
  if (error) throw error
  if (!data) throw new Error('getBankLogin: empty response')
  return data
}

export async function createBankLogin(body: CreateBankLoginBody): Promise<BankLoginDetail> {
  const { data, error } = await api.POST('/v1/banking/credentials', {
    body,
  })
  if (error) throw error
  if (!data) throw new Error('createBankLogin: empty response')
  return data
}

export async function updateBankLogin(
  credentialId: string,
  body: UpdateBankLoginBody,
): Promise<BankLoginDetail> {
  const { data, error } = await api.PATCH('/v1/banking/credentials/{credentialId}', {
    params: { path: { credentialId } },
    body,
  })
  if (error) throw error
  if (!data) throw new Error('updateBankLogin: empty response')
  return data
}

export async function deleteBankLogin(credentialId: string): Promise<void> {
  const { error } = await api.DELETE('/v1/banking/credentials/{credentialId}', {
    params: { path: { credentialId } },
  })
  if (error) throw error
}

// ─── Bank Accounts (anidadas al credential) ───────────────────────

export async function listBankAccounts(credentialId: string): Promise<BankAccountsListResponse> {
  const { data, error } = await api.GET('/v1/banking/credentials/{credentialId}/accounts', {
    params: { path: { credentialId } },
  })
  if (error) throw error
  if (!data) throw new Error('listBankAccounts: empty response')
  return data
}

export async function createBankAccount(
  credentialId: string,
  body: CreateBankAccountBody,
): Promise<BankAccountDetail> {
  const { data, error } = await api.POST('/v1/banking/credentials/{credentialId}/accounts', {
    params: { path: { credentialId } },
    body,
  })
  if (error) throw error
  if (!data) throw new Error('createBankAccount: empty response')
  return data
}

export async function updateBankAccount(
  accountId: string,
  body: UpdateBankAccountBody,
): Promise<BankAccountDetail> {
  const { data, error } = await api.PATCH('/v1/banking/accounts/{accountId}', {
    params: { path: { accountId } },
    body,
  })
  if (error) throw error
  if (!data) throw new Error('updateBankAccount: empty response')
  return data
}

export async function changeBankAccountStatus(
  accountId: string,
  body: ChangeBankAccountStatusBody,
): Promise<BankAccountDetail> {
  const { data, error } = await api.POST('/v1/banking/accounts/{accountId}/status', {
    params: { path: { accountId } },
    body,
  })
  if (error) throw error
  if (!data) throw new Error('changeBankAccountStatus: empty response')
  return data
}

export async function deleteBankAccount(accountId: string): Promise<void> {
  const { error } = await api.DELETE('/v1/banking/accounts/{accountId}', {
    params: { path: { accountId } },
  })
  if (error) throw error
}

// ─── Portales (catálogo) ──────────────────────────────────────────

export async function listBankPortals(): Promise<BankPortalsListResponse> {
  const { data, error } = await api.GET('/v1/banking/portals')
  if (error) throw error
  if (!data) throw new Error('listBankPortals: empty response')
  return data
}
