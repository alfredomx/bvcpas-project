// Wrappers sobre `/v1/clients/:id/followups/:period`.
// snake_case en data (D-bvcpas-020); el DTO de update usa camelCase
// porque es el body que el backend espera.

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Followup = components['schemas']['FollowupDto']
export type UpdateFollowupBody = components['schemas']['UpdateFollowupDto']

/**
 * Edita el followup de un período. Hoy el frontend lo usa para marcar
 * `status: 'sent'` + `sentAt` cuando se "envía" un follow-up
 * simulado (sin correo real).
 */
export async function updateFollowup(
  clientId: string,
  period: string,
  body: UpdateFollowupBody,
): Promise<Followup> {
  const { data, error } = await api.PATCH(
    '/v1/clients/{id}/followups/{period}',
    {
      params: { path: { id: clientId, period } },
      body,
    },
  )
  if (error) throw error
  if (!data) throw new Error('updateFollowup: empty response')
  return data
}
