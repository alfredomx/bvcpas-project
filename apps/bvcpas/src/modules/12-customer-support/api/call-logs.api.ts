// Wrappers sobre `/v1/clients/:id/call-logs`.
// snake_case 1:1 con el backend.
//
// El SDK auto-generado (`schema.ts`) registra los paths pero las
// responses están sin `content` tipado (el OpenAPI de mapi no
// declara el DTO de la respuesta). Por eso tipamos los retornos
// como `CallLog` local — el body de los request sí viene del SDK.

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type CallOutcome =
  | 'responded'
  | 'no_answer'
  | 'voicemail'
  | 'refused'
  | 'other'

export interface CallLog {
  id: string
  client_id: string
  user_id: string
  called_at: string
  outcome: CallOutcome
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CallLogsListResponse {
  items: CallLog[]
  limit: number
  offset: number
}

export type CreateCallLogBody = components['schemas']['CreateCallLogBodyDto']
export type UpdateCallLogBody = components['schemas']['UpdateCallLogBodyDto']

export async function listCallLogs(
  clientId: string,
): Promise<CallLogsListResponse> {
  const { data, error, response } = await api.GET(
    '/v1/clients/{id}/call-logs',
    {
      params: { path: { id: clientId } },
    },
  )
  if (error) throw error
  // El SDK no tipa el content del 200; data es never.
  // Caemos al response.json() directo manteniendo el tipo local.
  if (data) return data as unknown as CallLogsListResponse
  return (await response.json()) as CallLogsListResponse
}

export async function createCallLog(
  clientId: string,
  body: CreateCallLogBody,
): Promise<CallLog> {
  const { data, error, response } = await api.POST(
    '/v1/clients/{id}/call-logs',
    {
      params: { path: { id: clientId } },
      body,
    },
  )
  if (error) throw error
  if (data) return data as unknown as CallLog
  return (await response.json()) as CallLog
}

export async function updateCallLog(
  clientId: string,
  logId: string,
  body: UpdateCallLogBody,
): Promise<CallLog> {
  const { data, error, response } = await api.PATCH(
    '/v1/clients/{id}/call-logs/{logId}',
    {
      params: { path: { id: clientId, logId } },
      body,
    },
  )
  if (error) throw error
  if (data) return data as unknown as CallLog
  return (await response.json()) as CallLog
}

export async function deleteCallLog(
  clientId: string,
  logId: string,
): Promise<void> {
  const { error } = await api.DELETE(
    '/v1/clients/{id}/call-logs/{logId}',
    {
      params: { path: { id: clientId, logId } },
    },
  )
  if (error) throw error
}
