// Wrappers sobre los endpoints de integrations usando el SDK tipado.
//
// Endpoints cubiertos:
//   - GET    /v1/clients/:id/integrations       → dashboard
//   - POST   /v1/connections/:id/pause          → pausar
//   - POST   /v1/connections/:id/resume         → reanudar
//   - POST   /v1/connections/:id/test           → health-check vivo
//
// Tipos derivados del OpenAPI de mapi via `paths`/`components` en
// `@/lib/api/schema`. Naming snake_case 1:1 con el backend salvo
// los campos del response que ya vienen camelCase desde el DTO
// (legalName, providerLabel, externalAccountId, etc.).

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type IntegrationsDashboard =
  components['schemas']['ClientIntegrationsResponseDto']
export type IntegrationConnection =
  IntegrationsDashboard['connections'][number]
export type IntegrationStatus = IntegrationConnection['status']
export type IntegrationProvider = IntegrationConnection['provider']

export type TestConnectionResponse =
  components['schemas']['TestConnectionResponseDto']

export async function getClientIntegrations(
  clientId: string,
): Promise<IntegrationsDashboard> {
  const { data, error } = await api.GET('/v1/clients/{id}/integrations', {
    params: { path: { id: clientId } },
  })
  if (error) throw error
  if (!data) throw new Error('getClientIntegrations: empty response')
  return data
}

export async function pauseConnection(
  connectionId: string,
  reason?: string,
): Promise<void> {
  const { error } = await api.POST('/v1/connections/{id}/pause', {
    params: { path: { id: connectionId } },
    body: reason ? { reason } : {},
  })
  if (error) throw error
}

export async function resumeConnection(connectionId: string): Promise<void> {
  const { error } = await api.POST('/v1/connections/{id}/resume', {
    params: { path: { id: connectionId } },
  })
  if (error) throw error
}

export async function testConnection(
  connectionId: string,
): Promise<TestConnectionResponse> {
  const { data, error } = await api.POST('/v1/connections/{id}/test', {
    params: { path: { id: connectionId } },
  })
  if (error) throw error
  if (!data) throw new Error('testConnection: empty response')
  return data
}
