'use client'

// Hooks de call-logs: useCallLogs (read) + mutations
// (create/update/delete). Las 3 mutations invalidan
// `['call-logs', clientId]` en onSuccess para que la lista del
// dialog se refresque sin pedir refresh manual.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCallLog,
  deleteCallLog,
  listCallLogs,
  updateCallLog,
  type CallLog,
  type CallLogsListResponse,
  type CreateCallLogBody,
  type UpdateCallLogBody,
} from '../api/call-logs.api'

export function useCallLogs(clientId: string) {
  return useQuery<CallLogsListResponse>({
    queryKey: ['call-logs', clientId],
    queryFn: () => listCallLogs(clientId),
  })
}

export function useCreateCallLog(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation<CallLog, Error, CreateCallLogBody>({
    mutationFn: (body) => createCallLog(clientId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs', clientId] })
    },
  })
}

export function useUpdateCallLog(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation<CallLog, Error, { logId: string; body: UpdateCallLogBody }>({
    mutationFn: ({ logId, body }) => updateCallLog(clientId, logId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs', clientId] })
    },
  })
}

export function useDeleteCallLog(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (logId) => deleteCallLog(clientId, logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs', clientId] })
    },
  })
}
