// Wrappers sobre `/v1/clients/:id/public-links`.
// snake_case 1:1 con el backend (D-bvcpas-020).

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type PublicLink = components['schemas']['PublicLinkDto']
export type CreatePublicLinkBody = components['schemas']['CreatePublicLinkDto']
export type UpdatePublicLinkBody = components['schemas']['UpdatePublicLinkDto']

export interface CreatePublicLinkOptions {
  /**
   * Si `true`, mapi revoca el link activo previo (si lo hay) y emite
   * uno nuevo con token distinto. Default `false` (create-or-get).
   */
  force?: boolean
}

/**
 * Crea (o devuelve) el public link `uncats` de un cliente.
 * - Sin opciones: si ya hay link activo lo devuelve igual.
 * - Con `force: true`: revoca el viejo y emite uno nuevo.
 */
export async function createPublicLink(
  clientId: string,
  options?: CreatePublicLinkOptions,
): Promise<PublicLink> {
  const body: CreatePublicLinkBody = { purpose: 'uncats' }
  if (options?.force) body.force = true

  const { data, error } = await api.POST('/v1/clients/{id}/public-links', {
    params: { path: { id: clientId } },
    body,
  })
  if (error) throw error
  if (!data) throw new Error('createPublicLink: empty response')
  return data
}

/**
 * Revoca un public link. `linkId` debe ser el UUID del link
 * (viene en `UncatsDetailResponse.public_link.id`). Mapi valida que sea
 * UUID — no acepta el token.
 */
export async function revokePublicLink(
  clientId: string,
  linkId: string,
): Promise<void> {
  const { error } = await api.POST(
    '/v1/clients/{id}/public-links/{linkId}/revoke',
    {
      params: { path: { id: clientId, linkId } },
    },
  )
  if (error) throw error
}

/**
 * Edita un public link. Hoy el frontend solo lo usa para **anular una
 * revocación** mandando `revokedAt: null`. Otros campos quedan disponibles
 * para usos futuros.
 */
export async function updatePublicLink(
  clientId: string,
  linkId: string,
  body: UpdatePublicLinkBody,
): Promise<PublicLink> {
  const { data, error } = await api.PATCH(
    '/v1/clients/{id}/public-links/{linkId}',
    {
      params: { path: { id: clientId, linkId } },
      // El schema del PATCH usa un intersection raro que choca con
      // `revokedAt: null`. Cast quirurgico para no perder el tipo del body.
      body: body as never,
    },
  )
  if (error) throw error
  if (!data) throw new Error('updatePublicLink: empty response')
  return data
}
