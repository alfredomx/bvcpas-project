'use client'

// Mutation para guardar la nota del cliente final.
//
// Si la nota va vacía (trim) → DELETE; en cualquier otro caso → PATCH.
// El backend rechaza nota vacía en el PATCH, así que el DELETE es la
// puerta para que el cliente "deshaga" una respuesta.
//
// Optimistic update: el cache se actualiza ANTES de que responda el
// backend. UI cambia instantáneo (check verde aparece/desaparece,
// badge Pending/Answered, KPIs). En onError revertimos. En onSettled
// invalidamos para sincronizar con la verdad del backend.

import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  deletePublicNote,
  savePublicNote,
  type PublicUncatsResponse,
} from '../api/public-uncats.api'

interface Vars {
  txnId: string
  note: string
}

export function useSavePublicNote(token: string) {
  const queryClient = useQueryClient()
  const queryKey = ['public-uncats', token]

  return useMutation<void, Error, Vars, { previous: PublicUncatsResponse | undefined }>({
    mutationFn: async ({ txnId, note }) => {
      const trimmed = note.trim()
      if (trimmed === '') {
        await deletePublicNote(token, txnId)
      } else {
        await savePublicNote(token, txnId, { note: trimmed })
      }
    },
    onMutate: async ({ txnId, note }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<PublicUncatsResponse>(queryKey)
      if (previous) {
        const trimmed = note.trim()
        const nowIso = new Date().toISOString()
        queryClient.setQueryData<PublicUncatsResponse>(queryKey, {
          ...previous,
          items: previous.items.map((it) => {
            if (it.id !== txnId) return it
            if (trimmed === '') {
              return { ...it, response: null }
            }
            return {
              ...it,
              response: {
                client_note: trimmed,
                completed: false,
                responded_at: nowIso,
              },
            }
          }),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
