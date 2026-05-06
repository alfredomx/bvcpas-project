import { Injectable } from '@nestjs/common'
import type { Provider } from '../../db/schema/user-connections'
import { ConnectionsService } from './connections.service'
import { ProviderRegistry } from './provider-registry.service'

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 min

/**
 * Devuelve un access_token vigente para llamar a la API del provider.
 * Refresca on-demand si el token actual expira en <5 min, delegando la
 * llamada HTTP al provider correspondiente vía `IProvider.refresh()`.
 *
 * Genérico: no sabe nada de Microsoft/Google/etc. específicamente.
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
    if (decrypted.refreshToken === null) {
      // Sin refresh_token no podemos rotar — el provider dirá si necesita reauth.
      // Por simetría con el caso de invalid_grant, dejamos que el provider lance
      // ConnectionRefreshExpiredError.
      const provider = this.registry.get(decrypted.provider)
      const refreshed = await provider.refresh('')
      await this.persistRefreshed(decrypted, refreshed)
      return refreshed.accessToken
    }

    const provider = this.registry.get(decrypted.provider)
    const refreshed = await provider.refresh(decrypted.refreshToken)
    await this.persistRefreshed(decrypted, refreshed)
    return refreshed.accessToken
  }

  private async persistRefreshed(
    decrypted: {
      userId: string
      provider: string
      externalAccountId: string
      email: string | null
      label: string | null
    },
    refreshed: {
      accessToken: string
      refreshToken: string | null
      expiresIn: number
      scopes: string
    },
  ): Promise<void> {
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000)
    await this.connections.upsert({
      userId: decrypted.userId,
      provider: decrypted.provider as Provider,
      externalAccountId: decrypted.externalAccountId,
      email: decrypted.email,
      label: decrypted.label,
      scopes: refreshed.scopes,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      accessTokenExpiresAt: newExpiresAt,
    })
  }
}
