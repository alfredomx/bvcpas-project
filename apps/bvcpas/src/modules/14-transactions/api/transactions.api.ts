// Wrappers sobre `/v1/clients/:id/transactions` y
// `/v1/clients/:id/transactions/sync` usando el SDK tipado.
//
// snake_case 1:1 con el backend (D-bvcpas-020).

import { api } from '@/lib/api/client'
import type { components, paths } from '@/lib/api/schema'

export type TransactionsListResponse = components['schemas']['TransactionsListResponseDto']
export type Transaction = TransactionsListResponse['items'][number]
export type TransactionCategory = Transaction['category']

export type SyncResult = components['schemas']['SyncResultDto']
export type SyncBody = components['schemas']['SyncTransactionsBodyDto']
export type SaveNoteBody = components['schemas']['SaveNoteBodyDto']
export type TransactionResponse = components['schemas']['TransactionResponseDto']

export type ListTransactionsParams = NonNullable<
  paths['/v1/clients/{id}/transactions']['get']['parameters']['query']
>

export async function listTransactions(
  clientId: string,
  params?: ListTransactionsParams,
): Promise<TransactionsListResponse> {
  const { data, error } = await api.GET('/v1/clients/{id}/transactions', {
    params: {
      path: { id: clientId },
      query: params ?? {},
    },
  })
  if (error) throw error
  if (!data) throw new Error('listTransactions: empty response')
  return data
}

export interface SaveTransactionNoteOptions {
  /**
   * Si `true`, mapi además del upsert local hace writeback a QBO.
   * Equivale a query param `?qbo_sync=true`. Default `false`.
   */
  qboSync?: boolean
}

export async function saveTransactionNote(
  clientId: string,
  txnId: string,
  body: SaveNoteBody,
  options?: SaveTransactionNoteOptions,
): Promise<TransactionResponse> {
  const { data, error } = await api.PATCH(
    '/v1/clients/{id}/transactions/responses/{txnId}',
    {
      params: {
        path: { id: clientId, txnId },
        query: { qbo_sync: options?.qboSync ?? false },
      },
      body,
    },
  )
  if (error) throw error
  if (!data) throw new Error('saveTransactionNote: empty response')
  return data
}

/**
 * Soft-delete del response asociado a una transacción.
 * Mapi marca la fila con `deleted_at` pero no la borra físicamente.
 * Idempotente: si ya estaba borrado, devuelve 204 también.
 */
export async function deleteTransactionResponse(
  clientId: string,
  txnId: string,
): Promise<void> {
  const { error } = await api.DELETE(
    '/v1/clients/{id}/transactions/responses/{txnId}',
    {
      params: { path: { id: clientId, txnId } },
    },
  )
  if (error) throw error
}

export async function syncTransactions(
  clientId: string,
  body: SyncBody,
): Promise<SyncResult> {
  const { data, error } = await api.POST('/v1/clients/{id}/transactions/sync', {
    params: { path: { id: clientId } },
    body,
  })
  if (error) throw error
  if (!data) throw new Error('syncTransactions: empty response')
  return data
}
