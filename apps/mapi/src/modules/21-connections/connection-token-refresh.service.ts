import { Injectable } from '@nestjs/common'
import type { DecryptedUserConnection } from '../../db/schema/user-connections'
import type { TokenRefreshResult } from './providers/provider.interface'
import { ConnectionsService } from './connections.service'
import { ProviderRegistry } from './provider-registry.service'

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 min

/**
 * Devuelve un access_token vigente para llamar a la API del provider.
 * Refresca on-demand si el token actual expira en <5 min, delegando la
 * llamada HTTP al provider correspondiente vía `IProvider.refresh()`.
 *
 * Genérico: no sabe nada de Microsoft/Intuit/etc. específicamente.
 * Cada provider recibe la connection completa (no solo refreshToken)
 * porque algunos (Intuit) necesitan más contexto.
 */
@Injectable()
export class ConnectionTokenRefreshService {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly registry: ProviderRegistry,
  ) {}

  async getValidAccessToken(connectionId: string, userId: string): Promise<string> {
    const decrypted = await this.connections.getDecryptedByIdForUser(connectionId, userId)
    const msUntilExpiry = decrypted.accessTokenExpiresAt.getTime() - Date.now()
    if (msUntilExpiry > REFRESH_BUFFER_MS) {
      return decrypted.accessToken
    }
    const provider = this.registry.get(decrypted.provider)
    const refreshed = await provider.refresh(decrypted)
    await this.persistRefreshed(decrypted, refreshed)
    return refreshed.accessToken
  }

  private async persistRefreshed(
    decrypted: DecryptedUserConnection,
    refreshed: TokenRefreshResult,
  ): Promise<void> {
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000)
    const newRefreshExpiresAt =
      refreshed.refreshTokenExpiresIn !== undefined
        ? new Date(Date.now() + refreshed.refreshTokenExpiresIn * 1000)
        : null
    await this.connections.upsert({
      userId: decrypted.userId,
      provider: decrypted.provider,
      externalAccountId: decrypted.externalAccountId,
      clientId: decrypted.clientId,
      scopeType: decrypted.scopeType,
      email: decrypted.email,
      label: decrypted.label,
      scopes: refreshed.scopes,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      accessTokenExpiresAt: newExpiresAt,
      refreshTokenExpiresAt: newRefreshExpiresAt,
    })
  }
}
