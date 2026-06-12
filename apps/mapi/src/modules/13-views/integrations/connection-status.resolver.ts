import { Injectable } from '@nestjs/common'
import type { UserConnection } from '../../../db/schema/user-connections'

/**
 * Status posible de una conexión en el dashboard de integraciones (v0.14.0).
 *
 * - `healthy`: OAuth con refresh vigente, o api_key con credentials presentes.
 * - `needs_reauth`: OAuth con `refresh_token_expires_at` < now() o ausente.
 *   El operador debe re-autorizar.
 * - `paused`: el operador la pausó manualmente vía POST /v1/connections/:id/pause.
 *   `paused_at` no null.
 *
 * Decisión D-mapi-052: status se deriva en runtime desde columnas DB.
 * No se persiste — siempre refleja el estado actual.
 *
 * Decisión D-mapi-053: este resolver NO llama a `provider.test()`. El frontend
 * usa el endpoint existente POST /v1/connections/:id/test cuando el operador
 * da clic al botón "Test" en una row del dashboard.
 */
export type ConnectionStatus = 'healthy' | 'needs_reauth' | 'paused'

export interface ResolvedStatus {
  status: ConnectionStatus
  reason: string | null
}

@Injectable()
export class ConnectionStatusResolver {
  resolve(connection: UserConnection): ResolvedStatus {
    // 1. Paused gana sobre todo lo demás.
    if (connection.pausedAt !== null) {
      return { status: 'paused', reason: connection.pausedReason }
    }

    // 2. OAuth: necesita refresh vigente.
    if (connection.authType === 'oauth') {
      const refreshExp = connection.refreshTokenExpiresAt
      if (refreshExp === null || refreshExp.getTime() < Date.now()) {
        return { status: 'needs_reauth', reason: 'Refresh token expired' }
      }
    }

    // 3. api_key o OAuth con refresh vigente → healthy.
    return { status: 'healthy', reason: null }
  }
}
